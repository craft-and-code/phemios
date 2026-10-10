/** Circular keyboard movement skips unavailable choices and never selects an absent row. */
export function nextChoice(
  options: readonly { disabled?: boolean }[],
  current: number,
  delta: 1 | -1,
): number {
  if (!options.length) return -1;
  for (let distance = 1; distance <= options.length; distance++) {
    const index =
      (((current + distance * delta) % options.length) + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}
