/** Clamped single-selection movement; a missing selection starts at the nearest edge. */
export function objectListStep(
  items: readonly string[],
  selected: string | undefined,
  key: string,
) {
  if (!items.length) return undefined;
  const index = selected === undefined ? -1 : items.indexOf(selected);
  if (key === "Home") return items[0];
  if (key === "End") return items.at(-1);
  if (key === "ArrowDown") return items[Math.min(items.length - 1, index + 1)];
  if (key === "ArrowUp") return items[index < 0 ? items.length - 1 : Math.max(0, index - 1)];
  return selected;
}
/** Removing one object selects its predecessor, or its successor when it was first. */
export function objectListAfterRemoval(items: readonly string[], removed: string) {
  const index = items.indexOf(removed);
  return index < 0 ? undefined : (items[index - 1] ?? items[index + 1]);
}
/** Move before a retained target; dropping on the list tail appends without losing objects. */
export function reorderObjects(items: readonly string[], item: string, before?: string) {
  if (!items.includes(item) || item === before || (before !== undefined && !items.includes(before)))
    return [...items];
  const next = items.filter((id) => id !== item);
  next.splice(before === undefined ? next.length : next.indexOf(before), 0, item);
  return next;
}
