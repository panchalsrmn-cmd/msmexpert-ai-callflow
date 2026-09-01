import { GoogleGenAI } from '@google/genai';
import { meeraSystemInstruction } from '../voice/prompts/meera.system.js';

const model = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';
const voiceName = process.env.GEMINI_VOICE_NAME || 'Sulafat';

/** Browser testing only: returns one short-lived, one-use constrained token—not the API key. */
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'POST required' });
  if (!process.env.GEMINI_API_KEY) return response.status(503).json({ error: 'Voice service is not configured.' });
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
    const token = await ai.authTokens.create({ config: {
      uses: 1,
      newSessionExpireTime: new Date(Date.now() + 2 * 60_000).toISOString(),
      expireTime: new Date(Date.now() + 20 * 60_000).toISOString(),
      liveConnectConstraints: { model, config: {
        responseModalities: ['AUDIO'], systemInstruction: meeraSystemInstruction(request.body?.lead || {}),
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }, inputAudioTranscription: {}, outputAudioTranscription: {}
      } },
      lockAdditionalFields: []
    } });
    response.setHeader('cache-control', 'no-store');
    return response.status(200).json({ token: token.name, model, voice: voiceName });
  } catch (error) {
    console.error('[meera.live-token] failed', { message: error instanceof Error ? error.message : String(error) });
    return response.status(502).json({ error: 'Unable to start the voice session.' });
  }
}
