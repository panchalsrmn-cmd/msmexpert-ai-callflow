import http from 'node:http';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { GeminiLiveVoiceProvider } from './voice/providers/gemini-live.provider.js';
import { resamplePcm16 } from './voice/audio/codec.js';
import { createCrmBackend, finishCrmCall, initialiseCrm, saveRecording, saveTranscript, startCrmCall } from './voice/crm/postgres-crm.mjs';

const envFile = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
for (const line of envFile.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, ''); }
const config = { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025', voiceName: process.env.GEMINI_VOICE_NAME || process.env.GEMINI_TTS_VOICE || 'Sulafat' };
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
export function createVoiceServer({ webSocketPath = '/live', healthPath = '/health' } = {}) {
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.VOICE_ALLOWED_ORIGIN || 'http://127.0.0.1:5173');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/exotel/stream-complete') {
    const providerCallId = url.searchParams.get('callsid') || url.searchParams.get('call_sid');
    saveRecording({
      providerCallId,
      recordingUrl: url.searchParams.get('recordingurl') || url.searchParams.get('recording_url'),
      disposition: url.searchParams.get('status') || url.searchParams.get('disposition'),
      durationSeconds: url.searchParams.get('duration'),
    }).then(() => json(res, 200, { ok: true })).catch(error => {
      console.error('Exotel recording callback error:', error.message);
      json(res, 500, { ok: false });
    });
    return;
  }
  if (req.url === healthPath) return json(res, 200, { ok: true, provider: 'gemini-live', model: config.model, voice: config.voiceName, configured: Boolean(config.apiKey) });
  json(res, 404, { error: 'Not found' });
});
const wss = new WebSocketServer({ server, path: webSocketPath });
wss.on('connection', socket => {
  let voice; let startedAt; let exotelStream; let exotelOutbound = Buffer.alloc(0); let crmCall;
  const send = payload => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload)); };
  const closeVoice = async () => { if (voice) await voice.close(); voice = undefined; if (crmCall?.id) await finishCrmCall({ callId: crmCall.id }); };
  const startExotel = async message => {
    if (voice) return;
    const start = message.start || {};
    const mediaFormat = start.media_format || {};
    const sampleRate = Number(mediaFormat.sample_rate) || 8000;
    const streamSid = start.stream_sid || message.stream_sid;
    if (!streamSid) throw new Error('Exotel start event is missing stream_sid.');
    exotelStream = { streamSid, sampleRate };
    startedAt = Date.now();
    crmCall = await startCrmCall({ phone: start.from, providerCallId: start.call_sid || streamSid });
    voice = await new GeminiLiveVoiceProvider({ ...config, backend: createCrmBackend({ leadId: crmCall.lead.id, callId: crmCall.call?.id }) }).connect({
      callId: start.call_sid || streamSid,
      lead: { id: crmCall.lead.id, phone: start.from, exotelCallSid: start.call_sid, ...(start.custom_parameters || {}) },
    });
    voice.onAudio(chunk => {
      // Exotel requires 3,200–100,000 byte PCM frames, in multiples of 320.
      exotelOutbound = Buffer.concat([exotelOutbound, resamplePcm16(chunk, 24000, sampleRate)]);
      while (exotelOutbound.length >= 3200) {
        const bytes = Math.floor(Math.min(exotelOutbound.length, 16000) / 320) * 320;
        const audio = exotelOutbound.subarray(0, bytes);
        exotelOutbound = exotelOutbound.subarray(bytes);
        send({ event: 'media', stream_sid: streamSid, media: { payload: audio.toString('base64') } });
      }
    });
    voice.onError(error => console.error('Exotel AgentStream voice error:', error.message));
    voice.onEvent(event => console.log('Exotel AgentStream event:', event.type, Date.now() - startedAt));
    voice.onTranscript(event => saveTranscript({
      callId: crmCall.call?.id,
      speaker: event.type === 'assistant.transcript' ? 'MEERA' : 'CUSTOMER',
      text: event.text,
    }).catch(error => console.error('CRM transcript save error:', error.message)));
    // Telephony calls need an explicit first turn; waiting for caller audio produces silence.
    await voice.sendText('Start the call now. Speak only the configured opening line, then listen.');
  };
  socket.on('message', async raw => {
    try {
      const message = JSON.parse(raw.toString());
      // Exotel AgentStream / VoiceBot protocol: raw linear PCM, base64 encoded.
      if (message.event === 'connected') return;
      if (message.event === 'start') return startExotel(message);
      if (message.event === 'media') {
        if (!voice || !exotelStream) throw new Error('Exotel media arrived before start.');
        return voice.sendAudio(Buffer.from(message.media?.payload || '', 'base64'), exotelStream.sampleRate);
      }
      if (message.event === 'stop') { await closeVoice(); return socket.close(); }
      if (message.event === 'dtmf') return;
      if (message.type === 'start') {
        if (voice) return;
        startedAt = Date.now();
        voice = await new GeminiLiveVoiceProvider({ ...config, backend: createCrmBackend({ leadId: message.lead?.id, callId: message.callId }) }).connect({ callId: message.callId, lead: message.lead || {} });
        voice.onEvent(event => send({ type: 'event', event, latencyMs: Date.now() - startedAt })); voice.onTranscript(event => send({ type: 'transcript', event }));
        voice.onAudio(chunk => send({ type: 'audio', data: chunk.toString('base64'), mimeType: 'audio/pcm;rate=24000' })); voice.onError(error => send({ type: 'error', message: error.message }));
        return send({ type: 'ready', model: config.model, voice: config.voiceName });
      }
      if (!voice) throw new Error('Start a session first.');
      if (message.type === 'audio') return voice.sendAudio(Buffer.from(message.data, 'base64'), Number(message.sampleRate) || 16000);
      if (message.type === 'audio.end') return voice.endAudio();
      if (message.type === 'text') return voice.sendText(String(message.text || ''));
      if (message.type === 'interrupt') return voice.interrupt();
      if (message.type === 'end') { await closeVoice(); return socket.close(); }
    } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : 'Invalid voice message.' }); }
  });
  socket.on('close', () => closeVoice());
});
return server;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const port = Number(process.env.PORT || process.env.VOICE_PORT || 3002);
  const host = process.env.VOICE_HOST || '127.0.0.1';
  initialiseCrm().catch(error => console.error('CRM database unavailable:', error.message)).finally(() => createVoiceServer().listen(port, host, () => console.log(`Meera Live gateway listening on ws://${host}:${port}/live (${config.model}, ${config.voiceName})`)));
}
