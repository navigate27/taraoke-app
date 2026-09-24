/**
 * Incremental fixed-size analysis-window assembler. Feed arbitrary-length PCM
 * chunks (e.g. worklet render quanta decimated to 16 kHz); every complete
 * window is emitted in order and the leftover tail carries across chunks —
 * no gaps, no duplicated samples, regardless of chunk boundaries.
 *
 * Shared by the CREPE worker (2048-sample windows) and VoiceScorer's
 * main-thread heuristic fallback (1024-sample windows).
 */
export class WindowAssembler {
  private buf: Float32Array;
  private len = 0;

  constructor(readonly windowSize: number) {
    this.buf = new Float32Array(windowSize);
  }

  /** Samples currently buffered (carried over, not yet a full window). */
  get length(): number {
    return this.len;
  }

  /** Drop the oldest n buffered samples (pre-init backpressure cap). */
  dropOldest(n: number): void {
    const drop = Math.min(n, this.len);
    this.buf.copyWithin(0, drop, this.len);
    this.len -= drop;
  }

  /** Buffer a chunk and return every complete window it completes. */
  push(pcm: Float32Array): Float32Array[] {
    if (this.len + pcm.length > this.buf.length) {
      const grown = new Float32Array(Math.max(this.len + pcm.length, this.buf.length * 2));
      grown.set(this.buf.subarray(0, this.len));
      this.buf = grown;
    }
    this.buf.set(pcm, this.len);
    this.len += pcm.length;
    const out: Float32Array[] = [];
    while (this.len >= this.windowSize) {
      out.push(this.buf.slice(0, this.windowSize));
      this.buf.copyWithin(0, this.windowSize, this.len);
      this.len -= this.windowSize;
    }
    return out;
  }

  reset(): void {
    this.len = 0;
  }
}
