import * as tf from "@tensorflow/tfjs-core";
import { loadLayersModel } from "@tensorflow/tfjs-layers";
import type { LayersModel } from "@tensorflow/tfjs-layers";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { NoiseFloorTracker } from "../metrics";
import type { PitchAnalyzer } from "../PitchAnalyzer";
import type { FrameAnalysis } from "../types";
import { activationToPitch, CREPE_WINDOW } from "./crepeMath";

const CONFIDENCE_VOICED = 0.6;

export class CrepeAnalyzer implements PitchAnalyzer {
  private count = 0;
  private floor = new NoiseFloorTracker();
  private readonly stride: number;

  private constructor(private model: LayersModel, stride: number) {
    this.stride = stride;
  }

  static async load(stride = 2): Promise<CrepeAnalyzer> {
    setWasmPaths("/tfjs-wasm/");
    await tf.setBackend("wasm");
    await tf.ready();
    // ml5's hosted CREPE assets are in the TFJS *layers* format
    // (keras model_config), not the graph-model format — see commit body.
    const model = await loadLayersModel("/models/crepe/tiny/model.json");
    // Warm-up so the first real window doesn't stall on JIT/alloc.
    // Both the input and the prediction output are disposed explicitly.
    const warmupInput = tf.zeros([1, CREPE_WINDOW]);
    const warm = model.predict(warmupInput) as tf.Tensor;
    void (await warm.data());
    warm.dispose();
    warmupInput.dispose();
    return new CrepeAnalyzer(model, stride);
  }

  processWindow(window: Float32Array): FrameAnalysis | null {
    const rms = Math.sqrt(window.reduce((s, x) => s + x * x, 0) / window.length);
    this.floor.push(rms); // every window feeds the floor; inference is strided
    const floor = this.floor.calibrated ? this.floor.floor : rms * 0.5;
    const energy = Math.min(1, Math.max(0, (rms - floor) / (floor * 3 + 1e-9)));
    this.count++;
    if (this.count % this.stride !== 0) return null;
    // CREPE preprocessing (ml5 gh-pages crepe.js): subtract the frame mean,
    // then scale so the frame has unit RMS — divide by ‖zeroMean‖ / √1024.
    let mean = 0;
    for (let i = 0; i < window.length; i++) mean += window[i]!;
    mean /= window.length;
    let l2 = 0;
    for (let i = 0; i < window.length; i++) {
      const v = window[i]! - mean;
      l2 += v * v;
    }
    const scale = Math.sqrt(l2) / Math.sqrt(window.length); // unit-RMS divisor
    if (scale < 1e-9) {
      // Silent/DC frame: normalization is undefined — skip inference entirely.
      return { voiced: false, confidence: 0.05, hz: null, energy };
    }
    const normalized = new Float32Array(window.length);
    for (let i = 0; i < window.length; i++) normalized[i] = (window[i]! - mean) / scale;
    const input = tf.tensor2d(normalized, [1, CREPE_WINDOW]);
    const out = this.model.predict(input) as tf.Tensor;
    const activations = out.dataSync() as Float32Array; // sync inside the worker is fine
    input.dispose();
    out.dispose();
    const { hz, confidence } = activationToPitch(activations);
    const voiced = confidence >= CONFIDENCE_VOICED && rms > floor * 1.5;
    return { voiced, confidence: voiced ? confidence : 0.05, hz: voiced ? hz : null, energy };
  }

  reset(): void {
    this.count = 0;
    this.floor.reset();
  }
}
