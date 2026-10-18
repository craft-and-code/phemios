import { normalizeName } from "./filtering";
import type { MoodRule } from "./moods";
/** Presentation filtering preserves occurrence identities and never searches opaque references. */
export function queueSearch<
  T extends { title: string; artist: string; album: { title: string } | null },
>(rows: readonly T[], query: string): readonly T[] {
  const needle = normalizeName(query);
  return needle
    ? rows.filter((row) =>
        normalizeName(`${row.title} ${row.artist} ${row.album?.title ?? ""}`).includes(needle),
      )
    : rows;
}
/** Rule names and their visible recipe metadata are searched without a server request. */
export function moodSearch(
  rule: Pick<MoodRule, "name" | "tags" | "genres">,
  query: string,
): boolean {
  return normalizeName([rule.name, ...rule.tags, ...rule.genres].join(" ")).includes(
    normalizeName(query),
  );
}
