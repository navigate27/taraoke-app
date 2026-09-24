import { afterEach, describe, expect, it, vi } from "vitest";
import { randomScore } from "./ScoreReveal";

const originalRandom = Math.random;

afterEach(() => {
  Math.random = originalRandom;
});

describe("randomScore", () => {
  it("returns an integer within 60..100", () => {
    for (let i = 0; i < 200; i++) {
      const score = randomScore();
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(60);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("spans the full range at the bounds", () => {
    Math.random = () => 0;
    expect(randomScore()).toBe(60);
    Math.random = () => 0.999999;
    expect(randomScore()).toBe(100);
  });

  it("maps random values monotonically", () => {
    Math.random = () => 0.24;
    const low = randomScore();
    Math.random = () => 0.75;
    const high = randomScore();
    expect(high).toBeGreaterThan(low);
  });
});