/** Only the two outer neighbours fade; sorting starts at the new first album. */
export function coverOpacity(distance: number): number {
  const depth = Math.abs(distance);
  if (depth <= 2) return 1;
  if (depth <= 3) return 1 - (depth - 2) * 0.45;
  if (depth < 4) return 0.55 - (depth - 3) * 0.35;
  return Math.max(0, 0.2 - (depth - 4) * 0.2);
}
/** Horizontal dragging moves one album per 90 CSS pixels and clamps at either edge. */
export function draggedCover(start: number, dx: number, total: number): number {
  return Math.max(0, Math.min(total - 1, start - Math.round(dx / 90)));
}

/** A tap retains the original cover link; pointer capture starts only after a real drag. */
export function coverDragTarget(start: number, dx: number, total: number): number | undefined {
  return Math.abs(dx) > 6 ? draggedCover(start, dx, total) : undefined;
}
