import { describe, expect, it } from 'vitest';
import { BoundedAudioQueue, mulawToPcm16, pcm16To16k } from './audio/codec.js';
import { createToolExecutor } from './tools/meera-tools.js';

describe('voice safety primitives', () => {
  it('cancels stale playback after interruption', () => { const queue = new BoundedAudioQueue(2); queue.push(Buffer.from('one')); queue.cancel(); expect(queue.take()).toBeUndefined(); expect(queue.size).toBe(0); });
  it('bounds audio playback memory', () => { const queue = new BoundedAudioQueue(2); queue.push(Buffer.from('1')); queue.push(Buffer.from('2')); queue.push(Buffer.from('3')); expect(queue.size).toBe(2); expect(queue.take()?.toString()).toBe('2'); });
  it('converts 8k mu-law and resamples PCM to Gemini input', () => { expect(mulawToPcm16(Buffer.from([0xff])).length).toBe(2); expect(pcm16To16k(Buffer.alloc(16000), 8000).length).toBe(32000); });
  it('rejects non-whitelisted lead fields', async () => { const execute = createToolExecutor(); const result = await execute('updateLead', { leadId: 'a', fields: { password: 'nope' } }, 'x'); expect(result.ok).toBe(false); });
  it('does not replay side effects with the same idempotency key', async () => { let calls = 0; const execute = createToolExecutor({ markDoNotCall: async () => ({ ok: true, calls: ++calls }) }); const args = { leadId: 'lead-1', reason: 'customer opt out' }; expect((await execute('markDoNotCall', args, 'same')).calls).toBe(1); expect((await execute('markDoNotCall', args, 'same')).calls).toBe(1); });
});
