import { referenceSource } from "./sources";
import type { Album, Artist } from "./types";
import type { CatalogTrack } from "./track-page";

/** A catalogue placement, not a guessed recording identity. */
export interface BiographyTrackChoice {
  reference: string;
  title: string;
  album?: string;
  artist?: string;
  year?: number;
  number?: number;
}
export type BiographyTarget =
  | { kind: "artist"; reference: string }
  | { kind: "genre"; name: string }
  | { kind: "year"; year: number }
  | { kind: "tracks"; tracks: readonly BiographyTrackChoice[] };
export interface BiographyPart {
  text: string;
  target?: BiographyTarget;
}
export interface BiographyCatalog {
  albums: readonly Pick<Album, "reference" | "title" | "artist" | "year" | "tags">[];
  tracks: readonly Pick<
    CatalogTrack,
    "reference" | "title" | "release" | "album_title" | "track_no"
  >[];
}
type NamedArtist = Pick<Artist, "reference" | "name"> & Partial<Pick<Artist, "genre" | "genres">>;

/** Version qualifiers provide navigation choices, never a new recording identity. */
function titleNames(title: string): string[] {
  const qualified = /^(.*\S)\s+(?:\(([^()]*)\)|\[([^[\]]*)\])$/u.exec(title);
  const base = qualified?.[1],
    qualifier = qualified?.[2] ?? qualified?.[3] ?? "";
  return base &&
    /\s/u.test(base) &&
    /\b(?:live|version|mix|edit|remaster(?:ed)?|mono|stereo|acoustic|instrumental)\b/i.test(
      qualifier,
    )
    ? [title, base]
    : [title];
}

/** Short generic names need an explicit context instead of capturing incidental prose. */
function explicitMention(
  text: string,
  start: number,
  literal: string,
  target: BiographyTarget,
): boolean {
  if (target.kind === "artist" || target.kind === "year" || /\s/u.test(literal)) return true;
  const before = text.slice(0, start),
    after = text.slice(start + literal.length);
  if (/["“«‘']\s*$/u.test(before) && /^\s*["”»’']/u.test(after)) return true;
  if (target.kind === "tracks") return false;
  // Refuse a fragment of a longer, unavailable genre phrase (for example heavy + metal).
  const word = /([\p{L}\p{N}]+)[\s-]+$/u.exec(before)?.[1]?.toLowerCase();
  return (
    !word ||
    new Set([
      "a",
      "an",
      "and",
      "or",
      "of",
      "the",
      "in",
      "for",
      "et",
      "ou",
      "de",
      "du",
      "des",
      "le",
      "la",
      "les",
      "en",
      "au",
      "aux",
      "genre",
      "genres",
      "style",
      "styles",
    ]).has(word)
  );
}

/** Match literal whole names in one source; existing artist names precede genres and titles. */
export function biographyLinker(
  artists: readonly NamedArtist[],
  current: string,
  catalog?: BiographyCatalog,
): (text: string) => BiographyPart[] {
  const source = referenceSource(current),
    own = (reference: string) => referenceSource(reference) === source,
    names = new Map<string, NamedArtist[]>(),
    targets = new Map<string, { name: string; target: BiographyTarget }>();
  for (const artist of artists) {
    if (!own(artist.reference) || artist.name.trim().length < 3) continue;
    const key = artist.name.toLowerCase(),
      values = names.get(key) ?? [];
    if (!values.some((row) => row.reference === artist.reference)) values.push(artist);
    names.set(key, values);
  }
  for (const [key, rows] of names) {
    if (rows.length === 1 && rows[0]!.reference !== current)
      targets.set(key, {
        name: rows[0]!.name,
        target: { kind: "artist", reference: rows[0]!.reference },
      });
  }
  const albums = (catalog?.albums ?? []).filter((row) => own(row.reference)),
    albumByRef = new Map(albums.map((row) => [row.reference, row])),
    artistByRef = new Map(
      artists.filter((row) => own(row.reference)).map((row) => [row.reference, row]),
    );
  const genres = [
    ...artists
      .filter((row) => own(row.reference))
      .flatMap((row) => row.genres ?? (row.genre ? [row.genre] : [])),
    ...albums.flatMap((row) => row.tags),
  ];
  for (const name of genres) {
    const key = name.toLowerCase();
    if (name.trim().length >= 3 && !names.has(key) && !targets.has(key))
      targets.set(key, { name, target: { kind: "genre", name } });
  }
  // Chronology is a global catalogue predicate, not an artist association or source identity.
  for (const { year } of catalog?.albums ?? []) {
    if (year == null || !Number.isInteger(year) || year < 1000 || year > 9999) continue;
    const name = String(year);
    if (!targets.has(name)) targets.set(name, { name, target: { kind: "year", year } });
  }
  const titles = new Map<string, BiographyTrackChoice[]>();
  for (const row of catalog?.tracks ?? []) {
    if (!own(row.reference) || row.title.trim().length < 3) continue;
    const album = row.release ? albumByRef.get(row.release) : undefined,
      artist = album?.artist ? artistByRef.get(album.artist)?.name : undefined;
    const choice: BiographyTrackChoice = {
      reference: row.reference,
      title: row.title,
      ...(album?.title || row.album_title ? { album: album?.title || row.album_title! } : {}),
      ...(artist ? { artist } : {}),
      ...(album?.year != null ? { year: album.year } : {}),
      ...(row.track_no != null ? { number: row.track_no } : {}),
    };
    for (const name of titleNames(row.title)) {
      const key = name.toLowerCase();
      if (names.has(key) || targets.has(key)) continue;
      const rows = titles.get(key) ?? [];
      if (!rows.some((retained) => retained.reference === row.reference)) rows.push(choice);
      titles.set(key, rows);
    }
  }
  for (const [key, tracks] of titles)
    targets.set(key, { name: key, target: { kind: "tracks", tracks } });
  if (!targets.size) return (text) => [{ text }];
  // A catalogue can contain many thousands of titles. Probe only its distinct name lengths
  // at each word start rather than compiling every title into a catalogue-sized regexp.
  const lengths = new Map<string, Set<number>>();
  for (const { name } of targets.values()) {
    const first = [...name][0]!.toLowerCase(),
      values = lengths.get(first) ?? new Set<number>();
    values.add(name.length);
    lengths.set(first, values);
  }
  const probes = new Map(
    [...lengths].map(([first, values]) => [first, [...values].sort((a, b) => b - a)]),
  );
  return (text: string) => {
    const result: BiographyPart[] = [];
    let end = 0;
    for (const match of text.matchAll(/(?<![\p{L}\p{N}])\S/gu)) {
      if (match.index < end) continue;
      for (const length of probes.get(match[0].toLowerCase()) ?? []) {
        const next = match.index + length;
        if (next > text.length || /^[\p{L}\p{N}]/u.test(text.slice(next, next + 2))) continue;
        const literal = text.slice(match.index, next),
          target = targets.get(literal.toLowerCase())?.target;
        if (!target || !explicitMention(text, match.index, literal, target)) continue;
        if (match.index > end) result.push({ text: text.slice(end, match.index) });
        result.push({ text: literal, target });
        end = next;
        break;
      }
    }
    if (end < text.length) result.push({ text: text.slice(end) });
    return result;
  };
}

/** Single-paragraph convenience; long readers retain one compiled linker for all paragraphs. */
export function biographyLinks(
  text: string,
  artists: readonly NamedArtist[],
  current: string,
): BiographyPart[] {
  return biographyLinker(artists, current)(text);
}
