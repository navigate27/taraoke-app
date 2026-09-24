import { describe, expect, it } from "vitest";
import { NoiseFloorTracker, PerformanceMetrics } from "./metrics";
import type { FrameAnalysis } from "./types";

const frame = (over: Partial<FrameAnalysis> = {}): FrameAnalysis => ({
  voiced: true, confidence: 0.9, hz: 220, energy: 0.8, ...over,
});
const silence = (): FrameAnalysis => ({ voiced: false, confidence: 0.05, hz: null, energy: 0.02 });
const windowSec = 0.064; // heuristic-mode window at 16 kHz
const feed = (m: PerformanceMetrics, n: number, f: (i: number) => FrameAnalysis) => {
  for (let i = 0; i < n; i++) m.process(f(i));
};

describe("NoiseFloorTracker", () => {
  it("tracks the quiet level, not loud bursts", () => {
    const t = new NoiseFloorTracker();
    for (let i = 0; i < 100; i++) t.push(0.02);
    t.push(0.9); // clap
    expect(t.floor).toBeLessThan(0.05);
    expect(t.calibrated).toBe(true);
  });

  it("is not calibrated before enough samples", () => {
    const t = new NoiseFloorTracker();
    t.push(0.02);
    expect(t.calibrated).toBe(false);
  });
});

describe("PerformanceMetrics", () => {
  it("instrumental-only (floor-level audio) yields near-zero presence", () => {
    const m = new PerformanceMetrics({ windowSec });
    feed(m, 500, () => silence());
    const s = m.snapshot();
    expect(s.voicedRatio).toBeLessThan(0.05);
    expect(s.presence).toBeLessThan(0.05);
  });

  it("steady singing scores high presence and steadiness", () => {
    const m = new PerformanceMetrics({ windowSec });
    feed(m, 500, () => frame({ hz: 220, confidence: 0.9 }));
    const s = m.snapshot();
    expect(s.presence).toBeGreaterThan(0.9);
    expect(s.steadiness).toBeGreaterThan(0.85);
    expect(s.phrases).toBeGreaterThan(0.8);
  });

  it("dropouts break phrase streaks", () => {
    const m = new PerformanceMetrics({ windowSec });
    feed(m, 100, () => frame());
    feed(m, 50, () => silence());
    feed(m, 20, () => frame());
    expect(m.snapshot().longestStreakMs).toBeCloseTo(100 * windowSec * 1000, -1);
  });

  it("isolated voiced blips do not count as sustained phrases", () => {
    const m = new PerformanceMetrics({ windowSec });
    feed(m, 300, (i) => (i % 40 === 0 ? frame() : silence()));
    const s = m.snapshot();
    expect(s.phrases).toBeLessThan(0.1);
    expect(s.presence).toBeLessThan(0.1);
  });

  it("energy collapse at the end lowers the energy component", () => {
    const m = new PerformanceMetrics({ windowSec });
    feed(m, 400, () => frame({ energy: 0.8 }));
    feed(m, 100, () => frame({ energy: 0.05 }));
    const s = m.snapshot();
    const full = new PerformanceMetrics({ windowSec });
    feed(full, 500, () => frame({ energy: 0.8 }));
    expect(s.energy).toBeLessThan(full.snapshot().energy);
  });

  it("non-positive hz on voiced frames is skipped for pitch stats (no NaN poisoning)", () => {
    const m = new PerformanceMetrics({ windowSec });
    m.process(frame({ hz: 0 }));
    m.process(frame({ hz: -10 }));
    feed(m, 200, () => frame({ hz: 220 }));
    const s = m.snapshot();
    expect(Number.isFinite(s.steadiness)).toBe(true);
    expect(s.steadiness).toBeGreaterThanOrEqual(0);
    expect(s.steadiness).toBeLessThanOrEqual(1);
  });

  it("state stays bounded over long sessions", () => {
    const m = new PerformanceMetrics({ windowSec });
    feed(m, 10_000, (i) => frame({ hz: 440 + (i % 50) }));
    expect(() => m.snapshot()).not.toThrow();
    expect(m.snapshot().presence).toBeGreaterThan(0);
  });
});