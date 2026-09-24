import type { Grade, ScoreComponents, ScoreResult } from "./types";

// Tuning lives here so the Scoring Lab can calibrate without touching the pipeline.
export const WEIGHTS = { presence: 40, phrases: 25, steadiness: 20, energy: 15 } as const;
export const FLOOR = 35;
export const CURVE_EXPONENT = 0.8; // >1 would punish midrange; <1 is the generous videoke curve

export function scoreFromComponents(c: ScoreComponents): number {
  const raw =
    (WEIGHTS.presence * c.presence +
      WEIGHTS.phrases * c.phrases +
      WEIGHTS.steadiness * c.steadiness +
      WEIGHTS.energy * c.energy) /
    100;
  const clamped = Math.min(1, Math.max(0, raw));
  return Math.round(FLOOR + (100 - FLOOR) * Math.pow(clamped, CURVE_EXPONENT));
}

export function gradeFor(score: number): Grade {
  if (score >= 95) return "PERFECT!";
  if (score >= 85) return "GREAT";
  if (score >= 70) return "GOOD";
  if (score >= 55) return "OKAY";
  return "KEEP SINGING";
}

export function scoreAndGrade(c: ScoreComponents): ScoreResult {
  const score = scoreFromComponents(c);
  return { score, grade: gradeFor(score), components: c };
}