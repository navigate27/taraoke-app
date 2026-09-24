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
    const warm = model.predict(tf.zeros([1, CREPE_WINDOW])) as tf.Tensor;
    void (await warm.data());
    warm.dispose();
    return new CrepeAnalyzer(model, stride);
  }

  processWindow(window: Float32Array): FrameAnalysis | null {
    const rms = Math.sqrt(window.reduce((s, x) => s + x * x, 0) / window.length);
    this.floor.push(rms); // every window feeds the floor; inference is strided
    const floor = this.floor.calibrated ? this.floor.floor : rms * 0.5;
    const energy = Math.min(1, Math.max(0, (rms - floor) / (floor * 3 + 1e-9)));
    this.count++;
    if (this.count % this.stride !== 0) return null;
    const input = tf.tensor2d(Array.from(window), [1, CREPE_WINDOW]);
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