import { normalizeName } from "./filtering";
/** Match human metadata without random fragments of UUIDs; a complete typed identifier stays searchable. */
export function matchesQueueMetadata(values: readonly string[], query: string): boolean {
  const term = normalizeName(query);
  const text = normalizeName(values.join(" ")).replace(
    /\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi,
    (id) => (term.includes(id) ? id : " "),
  );
  return text.includes(term);
}
