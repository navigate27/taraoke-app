/// <reference lib="webworker" />
import { CrepeAnalyzer } from "./CrepeAnalyzer";
import { HeuristicAnalyzer } from "../heuristic/HeuristicAnalyzer";
import { CREPE_WINDOW } from "./crepeMath";
import type { FrameAnalysis } from "../types";

type In = { type: "init" } | { type: "pcm"; pcm: Float32Array };
type Out =
  | { type: "status"; mode: "crepe" | "heuristic" }
  | { type: "analysis"; frames: FrameAnalysis[] };

let analyzer: { processWindow(w: Float32Array): FrameAnalysis | null; reset(): void } | null =
  null;
let buf = new Float32Array(CREPE_WINDOW);
let bufLen = 0;

function drain(): void {
  if (!analyzer) return;
  while (bufLen >= CREPE_WINDOW) {
    const window = buf.slice(0, CREPE_WINDOW);
    buf.copyWithin(0, CREPE_WINDOW, bufLen);
    bufLen -= CREPE_WINDOW;
    const f = analyzer.processWindow(window);
    if (f) (self as unknown as Worker).postMessage({ type: "analysis", frames: [f] } satisfies Out);
  }
}

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
    if (bufLen + msg.pcm.length > buf.length) {
      const grown = new Float32Array(Math.max(bufLen + msg.pcm.length, buf.length * 2));
      grown.set(buf.subarray(0, bufLen));
      buf = grown;
    }
    buf.set(msg.pcm, bufLen);
    bufLen += msg.pcm.length;
    drain();
  }
};