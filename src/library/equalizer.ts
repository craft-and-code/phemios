/** Four decorative envelopes of actual output RMS, never random or a frequency spectrum. */
export function equalizerHeights(previous: readonly number[], level: number): number[] {
  const target = Math.min(1, Math.max(0, level));
  // Wider attack differences and fixed relative ranges keep steady music legible.
  const ranges = [0.65, 1, 0.8, 0.92];
  return [0.06, 0.65, 0.18, 0.9].map((rate, i) => {
    const value = previous[i] ?? 0;
    return value + (target * (ranges[i] ?? 1) - value) * rate;
  });
}
