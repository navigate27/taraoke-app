// Faithful to marl/crepe's TF discretize() (tiny model, 360 bins).
export const CREPE_WINDOW = 1024;
export const CREPE_CENTS_PER_BIN = 7180 / 360; // ≈ 19.9444
export const CREPE_BIN0_CENTS = 1997.3794084376191 - 7180 / 2; // ≈ -1592.62

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
  // softmax over all bins for a calibrated confidence
  let sumExp = 0;
  for (let i = 0; i < activations.length; i++) sumExp += Math.exp(activations[i]! - max);
  const confidence = 1 / sumExp; // exp(max - max) = 1 is the max term
  const cents = maxIdx * CREPE_CENTS_PER_BIN + CREPE_BIN0_CENTS;
  return { hz: 10 * Math.pow(2, cents / 1200), confidence };
}