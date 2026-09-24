import { describe, expect, it } from "vitest";
import { FLOOR, gradeFor, scoreAndGrade } from "./curve";
import type { ScoreComponents } from "./types";

const c = (presence: number, phrases: number, steadiness: number, energy: number): ScoreComponents => ({
  presence, phrases, steadiness, energy,
});

describe("scoreAndGrade", () => {
  it("silence lands on the soft floor (≈35) and never lower", () => {
    const r = scoreAndGrade(c(0, 0, 0, 0));
    expect(r.score).toBeGreaterThanOrEqual(FLOOR - 1);
    expect(r.score).toBeLessThanOrEqual(FLOOR + 2);
    expect(r.grade).toBe("KEEP SINGING");
  });

  it("a full steady performance reaches PERFECT!", () => {
    const r = scoreAndGrade(c(0.95, 0.9, 0.85, 0.9));
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(r.grade).toBe("PERFECT!");
  });

  it("talking-level activity lands in the OKAY band", () => {
    const r = scoreAndGrade(c(0.5, 0.3, 0.4, 0.5));
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.score).toBeLessThanOrEqual(69);
    expect(r.grade).toBe("OKAY");
  });

  it("grade boundaries are exact", () => {
    expect(gradeFor(94)).toBe("GREAT");
    expect(gradeFor(95)).toBe("PERFECT!");
    expect(gradeFor(85)).toBe("GREAT");
    expect(gradeFor(84)).toBe("GOOD");
    expect(gradeFor(70)).toBe("GOOD");
    expect(gradeFor(69)).toBe("OKAY");
    expect(gradeFor(55)).toBe("OKAY");
    expect(gradeFor(54)).toBe("KEEP SINGING");
  });

  it("components are echoed in the result", () => {
    const r = scoreAndGrade(c(1, 1, 1, 1));
    expect(r.components).toEqual(c(1, 1, 1, 1));
  });
});
