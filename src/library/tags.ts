import { normalizeName } from "./filtering";
import type { Annotation } from "./server";
/** Split committed separators, trim whitespace and preserve the first spelling of a tag. */
export function commitTags(selected: readonly string[], draft: string): string[] {
  const seen = new Set<string>();
  return [...selected, ...draft.split(",")]
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalizeName(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
/** Choosing a suggestion replaces only the final fragment; earlier comma-separated input stays pending. */
export function completeTagDraft(draft: string, suggestion: string): string {
  const fragments = draft.split(",");
  fragments[fragments.length - 1] = suggestion;
  return fragments.join(",");
}
/** Suggestions use only saved annotations loaded for the current account, never other owners. */
export function tagVocabulary(annotations: readonly (Annotation | undefined)[]): string[] {
  return commitTags(
    annotations.flatMap((row) => row?.tags ?? []),
    "",
  ).sort((a, b) => a.localeCompare(b, "fr"));
}
/** Prefix matching is accent/case insensitive, bounded and excludes already selected tokens. */
export function tagSuggestions(
  vocabulary: readonly string[],
  draft: string,
  selected: readonly string[],
): string[] {
  const fragments = draft.split(","),
    prefix = normalizeName(fragments.at(-1) ?? ""),
    held = new Set([...selected, ...fragments.slice(0, -1)].map(normalizeName));
  return prefix
    ? vocabulary
        .filter((tag) => normalizeName(tag).startsWith(prefix) && !held.has(normalizeName(tag)))
        .slice(0, 8)
    : [];
}
