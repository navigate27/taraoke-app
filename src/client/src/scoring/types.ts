export interface FrameAnalysis {
  voiced: boolean;
  confidence: number;
  hz: number | null;
  energy: number;
}
export interface ScoreComponents {
  presence: number;
  phrases: number;
  steadiness: number;
  energy: number;
}
export type Grade = "PERFECT!" | "GREAT" | "GOOD" | "OKAY" | "KEEP SINGING";
export interface ScoreResult {
  score: number;
  grade: Grade;
  components: ScoreComponents;
}