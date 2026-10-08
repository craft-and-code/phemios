/** FlacCompagnon's four response rates, applied to one measured output RMS at 60 ms cadence. */
export function equalizerHeights(previous: readonly number[], level: number): number[] {
  const target = Math.min(1, Math.max(0, level));
  return [0.14, 0.45, 0.24, 0.56].map((rate, i) => {
    const value = previous[i] ?? 0;
    return value + (target - value) * rate;
  });
}
