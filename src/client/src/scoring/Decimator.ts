/** Streaming linear-interpolation decimator; phase carries across chunks. */
export class Decimator {
  private phase = 0;
  constructor(private srcRate: number, private dstRate = 16000) {}

  process(input: Float32Array): Float32Array {
    const ratio = this.srcRate / this.dstRate;
    const out: number[] = [];
    let i = this.phase;
    while (i < input.length) {
      const i0 = Math.floor(i);
      const frac = i - i0;
      const s0 = input[i0] ?? 0;
      const s1 = input[i0 + 1] ?? s0;
      out.push(s0 + (s1 - s0) * frac);
      i += ratio;
    }
    this.phase = i - input.length;
    return new Float32Array(out);
  }

  reset(): void {
    this.phase = 0;
  }
}
