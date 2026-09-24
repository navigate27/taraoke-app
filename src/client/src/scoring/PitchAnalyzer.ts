import type { FrameAnalysis } from "./types";
export interface PitchAnalyzer {
  processWindow(window: Float32Array): FrameAnalysis | null;
  reset(): void;
}
