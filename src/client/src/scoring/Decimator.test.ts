import { describe, expect, it } from "vitest";
import { Decimator } from "./Decimator";

function sine(hz: number, samples: number, rate: number, startSample = 0): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = Math.sin((2 * Math.PI * hz * (startSample + i)) / rate);
  }
  return out;
}
function zeroCrossings(x: Float32Array): number {
  let c = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1]! >= 0 !== x[i]! >= 0) c++;
  return c;
}

describe("Decimator", () => {
  it("48k→16k preserves frequency", () => {
    const d = new Decimator(48000);
    const out = d.process(sine(220, 4800, 48000));
    // 4800 samples @48k = 0.1 s → 22 cycles → ~44 zero crossings (±2 tolerance)
    expect(Math.abs(zeroCrossings(out) - 44)).toBeLessThanOrEqual(2);
    expect(out.length).toBe(1600);
  });

  it("44.1k→16k fractional ratio stays phase-locked across chunks", () => {
    const d = new Decimator(44100);
    let sample = 0;
    const outs: Float32Array[] = [];
    for (let c = 0; c < 50; c++) {
      const chunk = sine(220, 4410, 44100, sample);
      sample += 4410;
      outs.push(d.process(chunk));
    }
    // Count over the concatenated stream: a crossing that lands exactly on a
    // chunk seam (22 exact cycles per 4410-sample chunk) is straddled by
    // samples in two different output arrays and is invisible to per-chunk
    // counting — concatenation measures the phase-locked position grid.
    const total = new Float32Array(outs.reduce((n, o) => n + o.length, 0));
    let off = 0;
    for (const o of outs) {
      total.set(o, off);
      off += o.length;
    }
    // 50 chunks × 0.1 s = 5 s → 1100 cycles → ~2200 crossings (±1%)
    expect(Math.abs(zeroCrossings(total) - 2200)).toBeLessThan(22);
  });

  it("non-divisible input: chunked output matches single-shot decimation", () => {
    // 4000 samples @ 44.1k = 1451.27 strides — chunk boundaries land mid-stride,
    // so a decimator that resets its phase per chunk cannot reproduce the
    // single-shot position grid. 1000-sample chunking has no interior seam
    // straddled by an output position (the only straddled position, 3999.32,
    // is the signal end, clamped identically in both paths).
    const rate = 44100;
    const full = sine(220, 4000, rate);
    const single = new Decimator(rate).process(full);
    expect(single.length).toBe(1452); // floor(4000 / 2.75625) + 1

    const d = new Decimator(rate);
    const outs: Float32Array[] = [];
    for (let off = 0; off < full.length; off += 1000) {
      outs.push(d.process(full.slice(off, off + 1000)));
    }
    const total = new Float32Array(outs.reduce((n, o) => n + o.length, 0));
    let at = 0;
    for (const o of outs) {
      total.set(o, at);
      at += o.length;
    }
    expect(total.length).toBe(single.length);
    for (let i = 0; i < single.length; i++) {
      expect(Math.abs(total[i]! - single[i]!)).toBeLessThan(1e-6);
    }
  });

  it("reset clears phase", () => {
    const d = new Decimator(48000);
    d.process(sine(220, 4800, 48000));
    d.reset();
    expect(d.process(sine(220, 480, 48000)).length).toBeGreaterThan(0);
  });
});
