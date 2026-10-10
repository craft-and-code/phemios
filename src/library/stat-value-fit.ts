/** Fit the measured whole value to its available cell width, retaining the ordinary 24 px maximum. */
export function statValueSize(available: number, natural: number): number {
  const target = Math.max(1, available - Math.min(12, available * 0.1));
  return available > 0 && natural > target ? Math.max(1, (24 * target) / (natural + 2)) : 24;
}
