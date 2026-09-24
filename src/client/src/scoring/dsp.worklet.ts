import { Decimator } from "./Decimator";

// AudioWorklet global-scope ambient declarations. lib.dom has no types for the
// worklet side (AudioWorkletProcessor / registerProcessor / sampleRate) and the
// repo doesn't ship @types/audioworklet; the runtime provides these globals
// when Vite instantiates this module as a worklet processor.
declare var sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}
declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

/// AudioWorkletProcessor: tap channel 0, decimate to 16 kHz, post to main thread.
class Mic16k extends AudioWorkletProcessor {
  private decimator: Decimator;

  constructor() {
    super();
    this.decimator = new Decimator(sampleRate);
  }
  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (ch && ch.length) {
      const dec = this.decimator.process(ch);
      if (dec.length) this.port.postMessage(dec, [dec.buffer]);
    }
    return true;
  }
}
registerProcessor("mic-16k", Mic16k);