import {
  matchesAlphabet,
  matchesFacets,
  matchesYear,
  searchAlbum,
  initialIndex,
} from "./filtering";
import type { Album, Artist, Filters, RailMode } from "./types";

export interface CountBin {
  value: number;
  count: number;
}

/** The last visible rail stays enabled; two icon toggles also express both. */
export function toggleRail(mode: RailMode, rail: "years" | "alphabet"): RailMode {
  if (mode === "both") return rail === "years" ? "alphabet" : "years";
  return mode === rail ? mode : "both";
}

/** Each histogram ignores its own interval and respects the other visible filters.
 * Artist counts deduplicate multiple releases from the same artist in a year.
 */
export function distributions(
  artists: readonly Artist[],
  albums: readonly Album[],
  filters: Filters,
  artistView: boolean,
) {
  const years = new Map<number, Set<string>>();
  const letters = new Map<number, Set<string>>();
  for (const album of albums) {
    const artist = artists.find((item) => item.reference === album.artist);
    if (!artist || !matchesFacets(artist, filters) || !searchAlbum(album, artist, filters.query))
      continue;
    const name = artistView ? artist.name : album.title;
    const identity = artistView ? artist.reference : album.reference;
    if (album.year !== null && matchesAlphabet(name, filters)) {
      const bin = years.get(album.year) ?? new Set<string>();
      bin.add(identity);
      years.set(album.year, bin);
    }
    if (matchesYear(album, filters)) {
      const index = initialIndex(name);
      const bin = letters.get(index) ?? new Set<string>();
      bin.add(identity);
      letters.set(index, bin);
    }
  }
  const rows = (map: Map<number, Set<string>>): CountBin[] =>
    [...map].map(([value, ids]) => ({ value, count: ids.size }));
  return { years: rows(years), alphabet: rows(letters) };
}
