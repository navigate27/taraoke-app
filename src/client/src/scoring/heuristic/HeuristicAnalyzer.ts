import { NoiseFloorTracker } from "../metrics";
import type { PitchAnalyzer } from "../PitchAnalyzer";
import type { FrameAnalysis } from "../types";

const MIN_HZ = 70;
const MAX_HZ = 1000;

/** Normalized autocorrelation pitch estimate; returns null below confidence. */
function estimatePitch(frame: Float32Array, sampleRate: number): { hz: number; confidence: number } | null {
  const rms = Math.sqrt(frame.reduce((s, x) => s + x * x, 0) / frame.length);
  if (rms < 1e-4) return null;
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.floor(sampleRate / MIN_HZ);
  const norms = new Float32Array(maxLag + 1);
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let energy = 0;
    for (let i = 0; i + lag < frame.length; i++) {
      corr += frame[i]! * frame[i + lag]!;
      energy += frame[i + lag]! * frame[i + lag]!;
    }
    const norm = corr / (energy + 1e-9);
    norms[lag] = norm;
    if (norm > best) {
      best = norm;
    }
  }
  if (best < 0.5) return null;
  // Prefer the smallest lag with near-best correlation (avoids octave-down errors).
  let bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (norms[lag]! >= 0.9 * best) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) return null;
  return { hz: sampleRate / bestLag, confidence: norms[bestLag]! };
}

export class HeuristicAnalyzer implements PitchAnalyzer {
  private floor = new NoiseFloorTracker();

  processWindow(window: Float32Array, sampleRate = 16000): FrameAnalysis {
    const rms = Math.sqrt(window.reduce((s, x) => s + x * x, 0) / window.length);
    this.floor.push(rms);
    const floor = this.floor.calibrated ? this.floor.floor : rms * 0.5;
    const energy = Math.min(1, Math.max(0, (rms - floor) / (floor * 3 + 1e-9)));
    const pitch = estimatePitch(window, sampleRate);
    const voiced = pitch !== null && pitch.confidence >= 0.6 && rms > floor * 1.5;
    return {
      voiced,
      confidence: voiced ? pitch.confidence : 0.05,
      hz: voiced ? pitch.hz : null,
      energy,
    };
  }

  reset(): void {
    this.floor.reset();
  }
}