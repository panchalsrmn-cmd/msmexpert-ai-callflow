/** PCM16 audio helpers. Gemini Live expects little-endian 16 kHz PCM input. */
export function pcm16To16k(input, sourceRate = 16000) {
  if (sourceRate === 16000) return Buffer.from(input);
  const source = new Int16Array(input.buffer, input.byteOffset, Math.floor(input.byteLength / 2));
  const count = Math.max(1, Math.floor(source.length * 16000 / sourceRate));
  const output = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) output.writeInt16LE(source[Math.min(source.length - 1, Math.floor(i * sourceRate / 16000))], i * 2);
  return output;
}

/** Resample signed little-endian PCM16 for a telephony transport. */
export function resamplePcm16(input, sourceRate, targetRate) {
  if (sourceRate === targetRate) return Buffer.from(input);
  const source = new Int16Array(input.buffer, input.byteOffset, Math.floor(input.byteLength / 2));
  if (!source.length) return Buffer.alloc(0);
  const count = Math.max(1, Math.floor(source.length * targetRate / sourceRate));
  const output = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    output.writeInt16LE(source[Math.min(source.length - 1, Math.floor(i * sourceRate / targetRate))], i * 2);
  }
  return output;
}

export function mulawToPcm16(input) {
  const out = Buffer.alloc(input.length * 2);
  for (let i = 0; i < input.length; i++) {
    let value = ~input[i], sign = value & 0x80, exponent = (value >> 4) & 7, mantissa = value & 15;
    let sample = ((mantissa << 3) + 0x84) << exponent; sample = sign ? 0x84 - sample : sample - 0x84;
    out.writeInt16LE(sample, i * 2);
  }
  return out;
}

export class BoundedAudioQueue {
  constructor(maxChunks = 24) { this.maxChunks = maxChunks; this.items = []; this.generation = 0; }
  push(chunk) { if (this.items.length >= this.maxChunks) this.items.shift(); this.items.push({ generation: this.generation, chunk }); }
  take() { const item = this.items.shift(); return item?.generation === this.generation ? item.chunk : undefined; }
  cancel() { this.generation++; this.items = []; }
  get size() { return this.items.length; }
}
