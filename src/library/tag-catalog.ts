import { normalizeName } from "./filtering";
import type { Annotation } from "./server";
/** Current-account annotations alone define the vocabulary; colliding source identities stay distinct. */
export function tagCatalog(rows: readonly (Annotation | undefined)[]) {
  const index = new Map<string, { key: string; label: string; references: Set<string> }>();
  for (const row of rows)
    for (const label of row?.tags ?? []) {
      const key = normalizeName(label.trim());
      if (!key || !row) continue;
      const held = index.get(key) ?? { key, label: label.trim(), references: new Set<string>() };
      held.references.add(row.reference);
      index.set(key, held);
    }
  return [...index.values()]
    .map(({ key, label, references }) => ({ key, label, count: references.size }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
/** Tag search is explicit in this view; assigning a tag to an artist never assigns it to their releases. */
export function taggedEntries(
  rows: readonly (Annotation | undefined)[],
  selected: string | readonly string[],
  query: string,
) {
  const keys = new Set(
      (typeof selected === "string" ? [selected] : selected).filter(Boolean).map(normalizeName),
    ),
    search = normalizeName(query);
  return rows.filter(
    (row): row is Annotation =>
      !!row &&
      row.tags.some((tag) => {
        const value = normalizeName(tag);
        return !!value && (!keys.size || keys.has(value)) && value.includes(search);
      }),
  );
}
/** Resolve at most ten visible track details, with two workers and per-item failures. */
export async function taggedTrackWindow<T>(
  references: readonly string[],
  offset: number,
  read: (reference: string) => Promise<T>,
) {
  const window = references.slice(offset, offset + 10);
  const results: ({ reference: string; track: T } | { reference: string; error: string })[] = [];
  let cursor = 0;
  await Promise.all(
    [0, 1].map(async () => {
      while (cursor < window.length) {
        const index = cursor++,
          reference = window[index]!;
        try {
          results[index] = { reference, track: await read(reference) };
        } catch (error) {
          results[index] = { reference, error: String(error) };
        }
      }
    }),
  );
  return results;
}
