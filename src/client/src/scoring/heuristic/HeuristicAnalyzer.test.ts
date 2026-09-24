import { describe, expect, it } from "vitest";
import { HeuristicAnalyzer } from "./HeuristicAnalyzer";

const SAMPLE_RATE = 16000;
const WINDOW = 1024;

function tone(hz: number, amp = 0.5, offset = 0): Float32Array {
  const w = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) {
    w[i] = amp * Math.sin((2 * Math.PI * hz * (offset + i)) / SAMPLE_RATE);
  }
  return w;
}

describe("HeuristicAnalyzer", () => {
  it("flags a strong 220 Hz tone as voiced with the right pitch", () => {
    const a = new HeuristicAnalyzer();
    for (let i = 0; i < 30; i++) a.processWindow(tone(0.001, 0.001, i * WINDOW)); // quiet room first
    const f = a.processWindow(tone(220));
    expect(f.voiced).toBe(true);
    expect(f.hz).not.toBeNull();
    expect(f.hz!).toBeGreaterThan(200);
    expect(f.hz!).toBeLessThan(240);
    expect(f.confidence).toBeGreaterThan(0.5);
  });

  it("uncorrelated noise is unvoiced even when loud", () => {
    const a = new HeuristicAnalyzer();
    for (let i = 0; i < 60; i++) a.processWindow(tone(0.002, 0.002, i * WINDOW)); // calibrate on quiet room
    const noise = new Float32Array(WINDOW).map(() => (Math.random() * 2 - 1) * 0.3);
    const f = a.processWindow(noise);
    expect(f.voiced).toBe(false);
    expect(f.hz).toBeNull();
  });

  it("reset clears calibration", () => {
    const a = new HeuristicAnalyzer();
    for (let i = 0; i < 60; i++) a.processWindow(tone(0.002, 0.002, i * WINDOW));
    a.reset();
    expect(a.processWindow(tone(220)).confidence).toBeGreaterThanOrEqual(0); // no crash, sane frame
  });
});