/** Fit the measured whole value to its available cell width, retaining the ordinary 24 px maximum. */
export function statValueSize(available: number, natural: number): number {
  return available > 0 && natural > available ? Math.max(1, (24 * available) / (natural + 2)) : 24;
}
