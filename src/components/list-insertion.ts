export interface ListInsertion<T extends string = string> {
  row: T | undefined;
  edge: "before" | "after";
  before: T | undefined;
}
/** Each insertion gap has one canonical edge, shared by its preview and released destination. */
export function listInsertion<T extends string>(
  list: HTMLElement,
  attribute: "data-object-item" | "data-menu-item",
  items: readonly T[],
  hit: Element | null,
  y: number,
): ListInsertion<T> | undefined {
  if (!hit || !Number.isFinite(y) || (hit !== list && !list.contains(hit))) return;
  const bounds = list.getBoundingClientRect();
  if (y < bounds.top || y > bounds.bottom) return;
  const hovered =
    typeof hit.closest === "function" ? hit.closest<HTMLElement>(`li[${attribute}]`) : null;
  if (
    hovered &&
    (hovered.parentElement !== list || !items.includes(hovered.getAttribute(attribute) as T))
  )
    return;
  if (!items.length) return { row: undefined, edge: "before", before: undefined };
  const rows = Array.from(list.children).filter((row) =>
    items.includes(row.getAttribute(attribute) as T),
  );
  const row = hovered ?? rows.find((row) => y <= row.getBoundingClientRect().bottom) ?? rows.at(-1);
  if (!row) return;
  const key = row.getAttribute(attribute) as T,
    box = row.getBoundingClientRect();
  const before = y < box.top + box.height / 2 ? key : items[items.indexOf(key) + 1];
  // The bottom of one row and the top of its successor are the same destination.
  return before === undefined
    ? { row: items.at(-1), edge: "after", before }
    : { row: before, edge: "before", before };
}
/** No-op and foreign drops must not advertise a changed position. */
export function movesListItem(items: readonly string[], from: string, before: string | undefined) {
  const index = items.indexOf(from);
  return (
    index >= 0 &&
    (before === undefined || items.includes(before)) &&
    from !== before &&
    items[index + 1] !== before
  );
}
