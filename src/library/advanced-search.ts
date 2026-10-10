import { t } from "../i18n";
export interface SearchCriteria {
  text: Record<string, string>;
  ranges: Record<string, [string, string]>;
  formats: readonly string[];
  scope: "any" | "track" | "album" | "artist";
  favourite: "" | "true" | "false";
  lossless: "" | "true" | "false";
  compilation: "" | "true" | "false";
}
export const blankSearch = (): SearchCriteria => ({
  text: {},
  ranges: {},
  formats: [],
  scope: "any",
  favourite: "",
  lossless: "",
  compilation: "",
});
export const searchTextFields = [
  "title",
  "artist",
  "album",
  "albumartist",
  "genre",
  "label",
  "path",
  "comment",
  "work",
  "composer",
  "performer",
  "instrument",
  "tag",
  "note",
] as const;
export const searchRanges = [
  "year",
  "samplerate",
  "bitdepth",
  "channels",
  "bitrate",
  "duration",
  "size",
  "played",
  "rating",
] as const;
/** Adjacent quoted segments preserve both quote characters in Aède's existing tokenizer. */
export const quoteQuery = (value: string) =>
  value
    .split('"')
    .map((part) => `"${part}"`)
    .join(`'"'`);
function scoped(field: string, value: string, scope: SearchCriteria["scope"]): string {
  const term = (prefix: string) => `${prefix}${field}:${value}`;
  return scope === "any"
    ? `(${["", "album.", "artist."].map(term).join(" OR ")})`
    : term(scope === "track" ? "" : `${scope}.`);
}
/** Serialize controls to the engine grammar; never evaluate personal/audio rules in the UI. */
export function advancedExpression(criteria: SearchCriteria): string {
  const terms: string[] = [];
  for (const field of searchTextFields) {
    const value = criteria.text[field]?.trim();
    if (!value) continue;
    if (value.includes("\0")) throw new Error(t("Critères de recherche invalides."));
    if (field === "tag") {
      for (const tag of value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean))
        terms.push(scoped(field, quoteQuery(tag), criteria.scope));
    } else if (field === "note") terms.push(scoped(field, quoteQuery(value), criteria.scope));
    else terms.push(`${field}:${quoteQuery(value)}`);
  }
  for (const field of searchRanges) {
    const bounds = criteria.ranges[field];
    if (!bounds || bounds.every((v) => !v.trim())) continue;
    const numbers = bounds.map((v) => (v.trim() ? Number(v) : undefined));
    if (
      numbers.some((v) => v !== undefined && (!Number.isFinite(v) || v < 0)) ||
      (numbers[0] !== undefined && numbers[1] !== undefined && numbers[0] > numbers[1]) ||
      (field === "rating" &&
        numbers.some((v) => v !== undefined && (!Number.isInteger(v) || v < 1 || v > 5)))
    )
      throw new Error(t("Bornes de recherche invalides."));
    const interval = numbers
      .map((v) => (v === undefined ? "" : String(field === "size" ? Math.round(v * 1048576) : v)))
      .join("..");
    terms.push(
      field === "rating" ? scoped(field, interval, criteria.scope) : `${field}:${interval}`,
    );
  }
  if (criteria.formats.length)
    terms.push(`(${criteria.formats.map((v) => `container:=${quoteQuery(v)}`).join(" OR ")})`);
  if (criteria.favourite)
    terms.push(
      criteria.scope === "any"
        ? `loved:${criteria.favourite}`
        : `${criteria.scope}.loved:${criteria.favourite}`,
    );
  if (criteria.lossless) terms.push(`lossless:${criteria.lossless}`);
  if (criteria.compilation) terms.push(`compilation:${criteria.compilation}`);
  const result = terms.join(" AND ");
  if (new TextEncoder().encode(result).length > 8192)
    throw new Error(t("Critères de recherche trop longs."));
  return result;
}
/** A queue collection retains membership; M3U retains its order and repeated occurrences. */
export function queueExpression(references: readonly string[]): string {
  return [...new Set(references)].map((reference) => `ref:=${quoteQuery(reference)}`).join(" OR ");
}
