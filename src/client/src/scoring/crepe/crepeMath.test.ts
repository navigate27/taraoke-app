import { describe, expect, it } from "vitest";
import { activationToPitch, CREPE_BIN0_CENTS, CREPE_CENTS_PER_BIN, hzToCentBin } from "./crepeMath";

describe("crepe bin mapping", () => {
  it("anchors 220 Hz on the trained grid at bin 168", () => {
    expect(CREPE_CENTS_PER_BIN).toBe(20); // 7180 / 359
    expect(hzToCentBin(220)).toBe(168);
  });

  it("maps bin 168 back into the audible 220 Hz neighborhood", () => {
    const cents = 168 * CREPE_CENTS_PER_BIN + CREPE_BIN0_CENTS;
    const hz = 10 * Math.pow(2, cents / 1200);
    expect(hz).toBeGreaterThan(215);
    expect(hz).toBeLessThan(225);
  });
});

describe("activationToPitch", () => {
  it("uses max activation as confidence and peaks at the true bin", () => {
    const bin = hzToCentBin(220);
    const act = new Float32Array(360);
    act[bin] = 0.95; // sigmoid-plausible peak, rest zero
    const { hz, confidence } = activationToPitch(act);
    expect(hz).toBeGreaterThan(210);
    expect(hz).toBeLessThan(230);
    expect(confidence).toBeGreaterThan(0.8);
  });

  it("low confidence when activations are flat", () => {
    const act = new Float32Array(360).fill(0.001);
    const { confidence } = activationToPitch(act);
    expect(confidence).toBeLessThan(0.1);
  });

  it("weighted average stays near the peak with neighbor mass", () => {
    const bin = hzToCentBin(220);
    const act = new Float32Array(360);
    act[bin] = 0.95;
    act[bin - 1] = 0.285; // 0.3 of the peak
    act[bin + 1] = 0.285;
    const { hz, confidence } = activationToPitch(act);
    expect(Math.abs(hz - 220)).toBeLessThanOrEqual(10);
    expect(confidence).toBeGreaterThan(0.8);
  });
});
