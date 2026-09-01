/** Provider-neutral contracts. The call application depends on these, never on Gemini messages. */
export class RealtimeVoiceSession {
  async sendAudio(_chunk) { throw new Error('Not implemented'); }
  async sendText(_text) { throw new Error('Not implemented'); }
  async interrupt() { throw new Error('Not implemented'); }
  async close() { throw new Error('Not implemented'); }
  onAudio(_callback) {}
  onTranscript(_callback) {}
  onEvent(_callback) {}
  onError(_callback) {}
}

export class RealtimeVoiceProvider { async connect(_options) { throw new Error('Not implemented'); } }

export const leadFields = ['name','companyName','city','state','industry','udyamStatus','zedStatus','interestLevel','languagePreference'];
