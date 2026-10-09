/** Repeating a star clears a personal rating or returns a minimum filter to its floor. */
export function nextStarSelection(
  current: number | null,
  clicked: number,
  floor: number | null = null,
): number | null {
  return current === clicked ? floor : clicked;
}
