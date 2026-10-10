import { referenceSource } from "./sources";
export interface BiographyPart {
  text: string;
  reference?: string;
}
/** Link unambiguous full artist names only within this source; prose stays plain, escaped text. */
export function biographyLinks(
  text: string,
  artists: readonly { name: string; reference: string }[],
  current: string,
): BiographyPart[] {
  const names = new Map<string, { name: string; reference: string }[]>();
  for (const artist of artists) {
    if (
      referenceSource(artist.reference) !== referenceSource(current) ||
      artist.name.trim().length < 3
    )
      continue;
    const key = artist.name.toLocaleLowerCase(),
      values = names.get(key) ?? [];
    values.push(artist);
    names.set(key, values);
  }
  const targets = [...names.values()]
    .filter((rows) => rows.length === 1 && rows[0]!.reference !== current)
    .map((rows) => rows[0]!);
  if (!targets.length) return [{ text }];
  const lookup = new Map(targets.map((row) => [row.name.toLocaleLowerCase(), row.reference]));
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${targets
      .sort((a, b) => b.name.length - a.name.length)
      .map((row) => escape(row.name))
      .join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const result: BiographyPart[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) result.push({ text: text.slice(end, match.index) });
    const reference = lookup.get(match[0].toLocaleLowerCase());
    result.push({ text: match[0], ...(reference ? { reference } : {}) });
    end = match.index + match[0].length;
  }
  if (end < text.length) result.push({ text: text.slice(end) });
  return result;
}
