/// <reference lib="webworker" />
import { CrepeAnalyzer } from "./CrepeAnalyzer";
import { HeuristicAnalyzer } from "../heuristic/HeuristicAnalyzer";
import { CREPE_WINDOW } from "./crepeMath";
import { WindowAssembler } from "../windowAsm";
import type { FrameAnalysis } from "../types";

type In = { type: "init" } | { type: "pcm"; pcm: Float32Array };
type Out =
  | { type: "status"; mode: "crepe" | "heuristic" }
  | { type: "analysis"; frames: FrameAnalysis[] };

let analyzer: { processWindow(w: Float32Array): FrameAnalysis | null; reset(): void } | null =
  null;
const windows = new WindowAssembler(CREPE_WINDOW);
// Cap pre-init buffering (64 windows): if model init stalls or fails, incoming
// PCM must not grow the buffer unboundedly — drop the oldest data instead.
const MAX_PREINIT_SAMPLES = 64 * CREPE_WINDOW;

self.onmessage = async (ev: MessageEvent<In>) => {
  const msg = ev.data;
  if (msg.type === "init") {
    try {
      analyzer = await CrepeAnalyzer.load();
      (self as unknown as Worker).postMessage({ type: "status", mode: "crepe" } satisfies Out);
    } catch {
      analyzer = new HeuristicAnalyzer();
      (self as unknown as Worker).postMessage({ type: "status", mode: "heuristic" } satisfies Out);
    }
    return;
  }
  if (msg.type === "pcm") {
    if (!analyzer) {
      // Pre-init: enforce the buffer cap by dropping the oldest samples.
      const overflow = windows.length + msg.pcm.length - MAX_PREINIT_SAMPLES;
      if (overflow > 0) windows.dropOldest(Math.min(overflow, windows.length));
    }
    for (const w of windows.push(msg.pcm)) {
      const f = analyzer?.processWindow(w);
      if (f) (self as unknown as Worker).postMessage({ type: "analysis", frames: [f] } satisfies Out);
    }
  }
};
