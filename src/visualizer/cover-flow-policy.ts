/** Only the two outer neighbours fade; sorting starts at the new first album. */
export function coverOpacity(distance: number): number {
  return Math.abs(distance) >= 4 ? 0.2 : Math.abs(distance) === 3 ? 0.55 : 1;
}
/** Horizontal dragging moves one album per 90 CSS pixels and clamps at either edge. */
export function draggedCover(start: number, dx: number, total: number): number {
  return Math.max(0, Math.min(total - 1, start - Math.round(dx / 90)));
}

/** A tap retains the original cover link; pointer capture starts only after a real drag. */
export function coverDragTarget(start: number, dx: number, total: number): number | undefined {
  return Math.abs(dx) > 6 ? draggedCover(start, dx, total) : undefined;
}
