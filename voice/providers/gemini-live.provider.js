import { GoogleGenAI, Modality } from '@google/genai';
import { RealtimeVoiceProvider, RealtimeVoiceSession } from '../domain/types.js';
import { pcm16To16k, BoundedAudioQueue } from '../audio/codec.js';
import { meeraSystemInstruction } from '../prompts/meera.system.js';
import { functionDeclarations, createToolExecutor } from '../tools/meera-tools.js';

export class GeminiLiveVoiceProvider extends RealtimeVoiceProvider {
  constructor({ apiKey, model, voiceName, backend, logger = console }) { super(); this.apiKey = apiKey; this.model = model; this.voiceName = voiceName; this.backend = backend; this.logger = logger; }
  async connect(options) { if (!this.apiKey) throw new Error('GEMINI_API_KEY is not configured.'); return GeminiLiveSession.create(this, options); }
}

class GeminiLiveSession extends RealtimeVoiceSession {
  static async create(provider, options) {
    const self = new GeminiLiveSession(provider, options);
    const ai = new GoogleGenAI({ apiKey: provider.apiKey });
    self.session = await ai.live.connect({ model: provider.model, config: {
      responseModalities: [Modality.AUDIO], systemInstruction: meeraSystemInstruction(options.lead),
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: provider.voiceName } } },
      inputAudioTranscription: {}, outputAudioTranscription: {}, tools: [{ functionDeclarations }],
      realtimeInputConfig: { automaticActivityDetection: { disabled: false, prefixPaddingMs: 20, silenceDurationMs: 500 } }
    }, callbacks: { onopen: () => self.emit('session.connected'), onmessage: message => self.handle(message), onerror: event => self.fail(event.error || new Error('Gemini Live connection failed.')), onclose: () => self.emit('session.closed') } });
    return self;
  }
  constructor(provider, options) { super(); this.provider = provider; this.options = options; this.audio = []; this.transcripts = []; this.events = []; this.errors = []; this.queue = new BoundedAudioQueue(); this.executor = createToolExecutor(provider.backend); this.callId = options.callId || crypto.randomUUID(); this.closed = false; }
  onAudio(cb) { this.audio.push(cb); } onTranscript(cb) { this.transcripts.push(cb); } onEvent(cb) { this.events.push(cb); } onError(cb) { this.errors.push(cb); }
  emit(type, extra = {}) { const event = { type, callId: this.callId, ...extra }; this.events.forEach(cb => cb(event)); }
  fail(error) { this.errors.forEach(cb => cb(error instanceof Error ? error : new Error(String(error)))); this.emit('error', { message: String(error?.message || error) }); }
  async sendAudio(chunk, sampleRate = 16000) { if (this.closed) return; const pcm = pcm16To16k(chunk, sampleRate); this.session.sendRealtimeInput({ media: { data: pcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' } }); }
  async endAudio() { if (!this.closed) this.session.sendRealtimeInput({ audioStreamEnd: true }); }
  async sendText(text) {
    if (this.closed) return;

    // Gemini Live expects structured Content objects, not a bare string.
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
  }
  async interrupt() { this.queue.cancel(); this.emit('assistant.interrupted'); }
  async close() { this.closed = true; this.queue.cancel(); this.session?.close(); }
  async handle(message) {
    const content = message.serverContent;
    if (content?.inputTranscription?.text) { const event = { type: 'customer.transcript', text: content.inputTranscription.text }; this.transcripts.forEach(cb => cb(event)); this.emit('customer.speech.ended'); }
    if (content?.outputTranscription?.text) { const event = { type: 'assistant.transcript', text: content.outputTranscription.text }; this.transcripts.forEach(cb => cb(event)); }
    for (const part of content?.modelTurn?.parts || []) if (part.inlineData?.data) { this.queue.push(Buffer.from(part.inlineData.data, 'base64')); const chunk = this.queue.take(); if (chunk) { this.emit('assistant.audio.chunk'); this.audio.forEach(cb => cb(chunk)); } }
    if (content?.interrupted) await this.interrupt();
    if (message.toolCall?.functionCalls) for (const call of message.toolCall.functionCalls) { this.emit('tool.started', { name: call.name }); const result = await this.executor(call.name, call.args || {}, `${this.callId}:${call.id}`); this.session.sendToolResponse({ functionResponses: [{ name: call.name, id: call.id, response: { result } }] }); this.emit('tool.completed', { name: call.name }); }
  }
}
