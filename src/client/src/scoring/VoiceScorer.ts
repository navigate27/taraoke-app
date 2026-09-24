import { PerformanceMetrics, componentsFromSnapshot } from "./metrics";
import { scoreAndGrade } from "./curve";
import { HeuristicAnalyzer } from "./heuristic/HeuristicAnalyzer";
import { WindowAssembler } from "./windowAsm";
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
// Main-thread fallback windows: 1024 samples @ 16 kHz = 64 ms.
const FALLBACK_WINDOW_SAMPLES = 1024;
// If the analyzer worker stays silent past this point (script failed to load,
// crashed before its first status, or model init stalled), degrade to the
// main-thread heuristic path — spec §2.2 mandates silent automatic fallback.
const WORKER_INIT_TIMEOUT_MS = 10_000;

export class VoiceScorer {
  onStatus?: (s: ScorerStatus) => void;
  onFrame?: (f: FrameAnalysis) => void;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private metrics = new PerformanceMetrics({ windowSec: HEURISTIC_WINDOW_SEC });
  private currentMode: ScorerStatus["mode"] = "idle";
  private active = false;  // a run is accumulating
  private paused = false;
  // Main-thread heuristic fallback (spec §2.2): populated when the analyzer
  // worker cannot be created, fails to load, crashes before its first status,
  // or stays silent past the init timeout. Null while the worker is trusted.
  private fallback: { windows: WindowAssembler; analyzer: HeuristicAnalyzer } | null = null;
  private initTimer: ReturnType<typeof setTimeout> | null = null;

  /** Current engine mode; read synchronously for live display. */
  get mode(): ScorerStatus["mode"] {
    return this.currentMode;
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      this.onStatus?.({ mode: "denied" });
      return;
    }
    try {
      this.worker = new Worker(new URL("./crepe/crepe.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // Construction can throw synchronously (unreachable script, CSP).
      // Degrade to the main-thread heuristic path; the mic graph below still
      // comes up, so scoring continues with degraded pitch data.
      this.enterFallback();
    }
    if (this.worker) {
      this.worker.onmessage = (ev) => this.onWorkerMessage(ev.data);
      this.worker.onerror = () => this.enterFallback();
      this.worker.postMessage({ type: "init" });
      this.initTimer = setTimeout(() => this.enterFallback(), WORKER_INIT_TIMEOUT_MS);
    }
    try {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      if (this.ctx.state === "suspended") await this.ctx.resume();
      await this.ctx.audioWorklet.addModule(micWorkletUrl);
      const node = new AudioWorkletNode(this.ctx, "mic-16k");
      node.port.onmessage = (ev) => this.onPcm(ev.data as Float32Array);
      this.ctx.createMediaStreamSource(this.stream).connect(node);
      // Not connected to destination: mic monitoring stays silent.
    } catch {
      // Partial setup (context, worklet module, node) — no audio source, so
      // the heuristic fallback is pointless too: release everything and take
      // the mic-unavailable path (scoring off, session otherwise normal).
      this.releaseResources();
      this.markDenied();
    }
  }

  private onWorkerMessage(msg: { type: string; mode?: string; frames?: FrameAnalysis[] }): void {
    // Any message proves the worker script loaded and is alive.
    this.clearInitTimer();
    if (msg.type === "status") {
      if (this.fallback) return; // fallback already engaged; ignore late status
      const mode = (msg.mode as ScorerStatus["mode"]) ?? "idle";
      if (mode === "crepe" || mode === "heuristic") this.setMode(mode);
      return;
    }
    if (msg.type === "analysis" && msg.frames) this.handleFrames(msg.frames);
  }

  private onPcm(pcm: Float32Array): void {
    if (this.worker) {
      // Worklet already decimated to 16 kHz; the worker assembles CREPE windows.
      this.worker.postMessage({ type: "pcm", pcm }, [pcm.buffer]);
      return;
    }
    if (!this.fallback) return;
    for (const w of this.fallback.windows.push(pcm)) {
      this.handleFrames([this.fallback.analyzer.processWindow(w)]);
    }
  }

  /** Switch to the main-thread heuristic path; idempotent, one-way. */
  private enterFallback(): void {
    if (this.fallback || this.currentMode === "denied") return;
    this.clearInitTimer();
    this.worker?.terminate();
    this.worker = null;
    this.fallback = {
      windows: new WindowAssembler(FALLBACK_WINDOW_SAMPLES),
      analyzer: new HeuristicAnalyzer(),
    };
    this.setMode("heuristic");
  }

  private handleFrames(frames: FrameAnalysis[]): void {
    if (!this.active || this.paused) return;
    for (const f of frames) {
      this.metrics.process(f);
      this.onFrame?.(f);
    }
  }

  private setMode(mode: ScorerStatus["mode"]): void {
    this.currentMode = mode;
    this.metrics = new PerformanceMetrics({
      windowSec: mode === "crepe" ? CREPE_WINDOW_SEC : HEURISTIC_WINDOW_SEC,
    });
    this.onStatus?.({ mode });
  }

  private markDenied(): void {
    this.clearInitTimer();
    this.currentMode = "denied";
    this.onStatus?.({ mode: "denied" });
  }

  private clearInitTimer(): void {
    if (this.initTimer !== null) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
  }

  private releaseResources(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.worker?.terminate();
    void this.ctx?.close();
    this.stream = null;
    this.worker = null;
    this.ctx = null;
    this.fallback = null;
    this.active = false;
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
    this.clearInitTimer();
    this.releaseResources();
    this.currentMode = "idle";
    this.onStatus?.({ mode: "idle" });
  }
}
