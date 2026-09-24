import { PerformanceMetrics, componentsFromSnapshot } from "./metrics";
import { scoreAndGrade } from "./curve";
import type { FrameAnalysis, ScoreResult } from "./types";
// Vite compiles this to a self-contained bundled script (imports inlined) and
// yields its URL. A plain `new URL("./dsp.worklet.ts", import.meta.url)` would
// be emitted as a raw asset of the untranspiled TS source in production builds,
// which addModule cannot execute.
import micWorkletUrl from "./dsp.worklet.ts?worker&url";

export type ScorerStatus =
  | { mode: "idle" }
  | { mode: "crepe" }     // listening — CREPE engine loaded
  | { mode: "heuristic" } // listening — fallback engine (model failed to load)
  | { mode: "denied" };   // mic permission refused — scoring off this session

const CREPE_WINDOW_SEC = 0.128;  // stride-2 × 64 ms windows
const HEURISTIC_WINDOW_SEC = 0.064;

export class VoiceScorer {
  onStatus?: (s: ScorerStatus) => void;
  onFrame?: (f: FrameAnalysis) => void;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private metrics = new PerformanceMetrics({ windowSec: HEURISTIC_WINDOW_SEC });
  private mode: ScorerStatus["mode"] = "idle";
  private active = false;  // a run is accumulating
  private paused = false;

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      this.onStatus?.({ mode: "denied" });
      return;
    }
    this.worker = new Worker(new URL("./crepe/crepe.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (ev) => this.onWorkerMessage(ev.data);
    this.worker.postMessage({ type: "init" });
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    if (this.ctx.state === "suspended") await this.ctx.resume();
    await this.ctx.audioWorklet.addModule(micWorkletUrl);
    const node = new AudioWorkletNode(this.ctx, "mic-16k");
    node.port.onmessage = (ev) => this.onPcm(ev.data as Float32Array);
    this.ctx.createMediaStreamSource(this.stream).connect(node);
    // Not connected to destination: mic monitoring stays silent.
  }

  private onWorkerMessage(msg: { type: string; mode?: string; frames?: FrameAnalysis[] }): void {
    if (msg.type === "status") {
      const mode = (msg.mode as ScorerStatus["mode"]) ?? "idle";
      this.metrics = new PerformanceMetrics({
        windowSec: mode === "crepe" ? CREPE_WINDOW_SEC : HEURISTIC_WINDOW_SEC,
      });
      this.onStatus?.({ mode });
    }
    if (msg.type === "analysis" && msg.frames && this.active && !this.paused) {
      for (const f of msg.frames) {
        this.metrics.process(f);
        this.onFrame?.(f);
      }
    }
  }

  private onPcm(pcm: Float32Array): void {
    // Worklet already decimated to 16 kHz; the worker assembles CREPE windows.
    this.worker?.postMessage({ type: "pcm", pcm }, [pcm.buffer]);
  }

  get running(): boolean {
    return this.active && !this.paused;
  }

  startRun(): void {
    this.metrics.reset();
    this.active = true;
    this.paused = false;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
  finalizeRun(): ScoreResult | null {
    if (!this.active) return null;
    this.active = false;
    return scoreAndGrade(componentsFromSnapshot(this.metrics.snapshot()));
  }
  discardRun(): void {
    this.active = false;
  }
  preview(): ScoreResult | null {
    return this.active ? scoreAndGrade(componentsFromSnapshot(this.metrics.snapshot())) : null;
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.worker?.terminate();
    void this.ctx?.close();
    this.stream = null;
    this.worker = null;
    this.ctx = null;
    this.active = false;
  }
}