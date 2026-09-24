import { afterEach, describe, expect, it, vi } from "vitest";
import { GRADE_TIERS, randomScore, tierFor } from "./ScoreReveal";

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

describe("tierFor", () => {
  it("defines exactly ten tiers with unique badges and non-empty comments", () => {
    expect(GRADE_TIERS).toHaveLength(10);
    const badges = new Set(GRADE_TIERS.map((t) => t.badge));
    expect(badges.size).toBe(10);
    for (const tier of GRADE_TIERS) {
      expect(tier.comments.length).toBeGreaterThan(0);
      for (const text of tier.comments) expect(text.length).toBeGreaterThan(0);
    }
  });

  it("maps every possible score 60..100 to a tier with a matching comment", () => {
    for (let score = 60; score <= 100; score++) {
      const tier = tierFor(score);
      expect(tier.badge.length).toBeGreaterThan(0);
      expect(tier.comments).toContain(pickFrom(tier));
    }
    expect(tierFor(60).badge).toBe("YIKES");
    expect(tierFor(100).badge).toBe("PERFECT!");
    expect(tierFor(79).badge).toBe("NOT BAD");
    expect(tierFor(80).badge).toBe("NICE");
  });

  it("orders tiers from low to high by min", () => {
    const mins = GRADE_TIERS.map((t) => t.min);
    const sorted = [...mins].sort((a, b) => b - a);
    expect(mins).toEqual(sorted);
  });
});

function pickFrom(tier: (typeof GRADE_TIERS)[number]): string {
  return tier.comments[Math.floor(Math.random() * tier.comments.length)] ?? "";
}