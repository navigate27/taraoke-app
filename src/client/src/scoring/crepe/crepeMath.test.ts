import { describe, expect, it } from "vitest";
import { activationToPitch, CREPE_BIN0_CENTS, CREPE_CENTS_PER_BIN, hzToCentBin } from "./crepeMath";

describe("activationToPitch", () => {
  it("returns the bin with the max softmax mass", () => {
    const bin = hzToCentBin(220);
    const act = new Float32Array(360);
    act[bin] = 10; // strong peak → softmax mass concentrates (≈0.98)
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
});