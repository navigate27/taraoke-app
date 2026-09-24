import type { FrameAnalysis, ScoreComponents } from "./types";

const FLOOR_RING_CAP = 256; // ~15 s of 64 ms windows
const TAIL_RING_CAP = 128;  // recent-energy ring for the "last quarter" tail

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export class NoiseFloorTracker {
  private ring = new Float32Array(FLOOR_RING_CAP);
  private len = 0;
  private idx = 0;
  private cached: number | null = null;

  push(energy: number): void {
    this.ring[this.idx] = energy;
    this.idx = (this.idx + 1) % FLOOR_RING_CAP;
    if (this.len < FLOOR_RING_CAP) this.len++;
    this.cached = null;
  }

  get calibrated(): boolean {
    return this.len >= 25;
  }

  /** ~40th percentile of recent frame energies — the "room + instrumental" level. */
  get floor(): number {
    if (this.cached === null) {
      const slice = Array.from(this.ring.subarray(0, this.len)).sort((a, b) => a - b);
      this.cached = slice.length ? slice[Math.floor(slice.length * 0.4)]! : 0.01;
    }
    return this.cached;
  }

  reset(): void {
    this.len = 0;
    this.idx = 0;
    this.cached = null;
  }
}

export interface MetricsSnapshot {
  presence: number;    // 0..1 curve component
  phrases: number;     // 0..1 curve component
  steadiness: number;  // 0..1 curve component
  energy: number;      // 0..1 curve component
  voicedRatio: number; // raw diagnostics for the lab meters
  longestStreakMs: number;
  frameCount: number;
}

interface Options {
  windowSec?: number;       // duration each FrameAnalysis represents
  phraseTargetSec?: number; // sustained singing at/above this scores 1.0
}

export class PerformanceMetrics {
  private readonly windowSec: number;
  private readonly phraseTargetSec: number;
  private floor = new NoiseFloorTracker();
  private frames = 0;
  private voiced = 0;
  private streak = 0;
  private longestStreak = 0;
  private energySum = 0;
  private tail = new Float32Array(TAIL_RING_CAP);
  private tailIdx = 0;
  private tailLen = 0;
  private tailSum = 0;
  private centsX = 0;
  private centsX2 = 0;
  private centsN = 0;

  constructor(opts?: Options) {
    this.windowSec = opts?.windowSec ?? 0.064;
    this.phraseTargetSec = opts?.phraseTargetSec ?? 12;
  }

  process(frame: FrameAnalysis): void {
    this.frames++;
    this.floor.push(frame.energy);
    if (frame.voiced) {
      this.voiced++;
      this.streak++;
      if (this.streak > this.longestStreak) this.longestStreak = this.streak;
      if (frame.hz !== null) {
        const cents = 1200 * Math.log2(frame.hz / 220); // offset cancels in variance
        this.centsX += cents;
        this.centsX2 += cents * cents;
        this.centsN++;
      }
    } else {
      this.streak = 0;
    }
    if (this.tailLen === TAIL_RING_CAP) this.tailSum -= this.tail[this.tailIdx]!;
    this.tail[this.tailIdx] = frame.energy;
    this.tailSum += frame.energy;
    this.tailIdx = (this.tailIdx + 1) % TAIL_RING_CAP;
    this.tailLen = Math.min(TAIL_RING_CAP, this.tailLen + 1);
    this.energySum += frame.energy;
  }

  snapshot(): MetricsSnapshot {
    const voicedRatio = this.frames ? this.voiced / this.frames : 0;
    const longestStreakMs = this.longestStreak * this.windowSec * 1000;

    const presence = clamp01(voicedRatio / 0.6); // 60%+ voiced = full marks (generous)
    const longestSec = this.longestStreak * this.windowSec;
    const phrases = clamp01(longestSec / this.phraseTargetSec);

    let steadiness = 0.5; // neutral when no pitch data (heuristic fallback)
    if (this.centsN > 10) {
      const mean = this.centsX / this.centsN;
      const variance = this.centsX2 / this.centsN - mean * mean;
      steadiness = clamp01(1 - Math.sqrt(Math.max(0, variance)) / 500);
    }

    const meanEnergy = this.frames ? this.energySum / this.frames : 0;
    const tailMean = this.tailLen ? this.tailSum / this.tailLen : 0;
    const energy = clamp01(0.6 * clamp01(meanEnergy / 0.6) + 0.4 * clamp01(tailMean / 0.6));

    return {
      presence,
      phrases,
      steadiness,
      energy,
      voicedRatio,
      longestStreakMs,
      frameCount: this.frames,
    };
  }

  reset(): void {
    this.frames = 0;
    this.voiced = 0;
    this.streak = 0;
    this.longestStreak = 0;
    this.energySum = 0;
    this.tailSum = 0;
    this.tailIdx = 0;
    this.tailLen = 0;
    this.centsX = 0;
    this.centsX2 = 0;
    this.centsN = 0;
    this.floor.reset();
  }
}

export function componentsFromSnapshot(s: MetricsSnapshot): ScoreComponents {
  return { presence: s.presence, phrases: s.phrases, steadiness: s.steadiness, energy: s.energy };
}