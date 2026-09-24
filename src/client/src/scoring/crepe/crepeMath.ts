// Faithful to marl/crepe's TF discretize() (tiny model, 360 bins) and to the
// ml5 gh-pages PitchDetection/index.js that produced the vendored model:
// cents(i) = i * (7180 / 359) + 1997.3794084376191 — np.linspace(0, 7180, 360)
// has a step of exactly 20 cents, bin 0 ≈ 31.6 Hz, bin 359 ≈ 2 kHz.
export const CREPE_WINDOW = 1024;
export const CREPE_CENTS_PER_BIN = 7180 / 359; // exactly 20
export const CREPE_BIN0_CENTS = 1997.3794084376191; // ≈ 31.6 Hz

export function hzToCentBin(hz: number): number {
  const cents = 1200 * Math.log2(hz / 10);
  return Math.round((cents - CREPE_BIN0_CENTS) / CREPE_CENTS_PER_BIN);
}

export function activationToPitch(activations: Float32Array): { hz: number; confidence: number } {
  let max = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < activations.length; i++) {
    if (activations[i]! > max) {
      max = activations[i]!;
      maxIdx = i;
    }
  }
  // CREPE confidence is the raw max activation (the Dense(360, sigmoid) output
  // is already a per-bin voicing probability) — marl/crepe core.py:
  // confidence = activation.max(axis=1). No softmax.
  const confidence = Math.min(1, Math.max(0, max));
  // Reference local weighted average: average cents over the argmax ±4 bins,
  // weighted by the activation values, to smooth sigmoid noise.
  const from = Math.max(0, maxIdx - 4);
  const to = Math.min(activations.length - 1, maxIdx + 4);
  let weightedCents = 0;
  let mass = 0;
  for (let i = from; i <= to; i++) {
    weightedCents += activations[i]! * (i * CREPE_CENTS_PER_BIN + CREPE_BIN0_CENTS);
    mass += activations[i]!;
  }
  const cents =
    mass > 1e-9 ? weightedCents / mass : maxIdx * CREPE_CENTS_PER_BIN + CREPE_BIN0_CENTS;
  return { hz: 10 * Math.pow(2, cents / 1200), confidence };
}
