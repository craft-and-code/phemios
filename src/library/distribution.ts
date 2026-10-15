import { isRecentAlbum } from "./recent-albums";
import {
  matchesAlphabet,
  matchesFacets,
  matchesYear,
  searchAlbum,
  initialIndex,
  searchArtist,
} from "./filtering";
import { catalogIndex } from "./index";
import type { Album, Artist, Filters, RailMode } from "./types";

export interface CountBin {
  value: number;
  count: number;
}

/** Each icon independently toggles its rail; none disables both interval filters. */
export function toggleRail(mode: RailMode, rail: "years" | "alphabet"): RailMode {
  if (mode === "both") return rail === "years" ? "alphabet" : "years";
  if (mode === "none") return rail;
  return mode === rail ? "none" : "both";
}

/** Each histogram ignores its own interval and respects the other visible filters.
 * Artist counts deduplicate multiple releases from the same artist in a year.
 */
export function distributions(
  artists: readonly Artist[],
  albums: readonly Album[],
  filters: Filters,
  artistView: boolean,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const years = new Map<number, Set<string>>();
  const letters = new Map<number, Set<string>>();
  const index = catalogIndex(artists, albums);
  for (const album of albums) {
    if (filters.recentOnly && !isRecentAlbum(album, nowSeconds)) continue;
    const related = index.artistsByAlbum.get(album.reference) ?? [];
    for (const artist of related) {
      if (!matchesFacets(artist, filters) || !searchAlbum(album, artist, filters.query)) continue;
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
  }
  if (artistView)
    for (const artist of artists) {
      if (
        index.albumsByArtist.has(artist.reference) ||
        !matchesFacets(artist, filters) ||
        !searchArtist(artist, filters.query) ||
        (["years", "both"].includes(filters.mode) && !filters.includeUnknownYear)
      )
        continue;
      const initial = initialIndex(artist.name),
        bin = letters.get(initial) ?? new Set<string>();
      bin.add(artist.reference);
      letters.set(initial, bin);
    }
  const rows = (map: Map<number, Set<string>>): CountBin[] =>
    [...map].map(([value, ids]) => ({ value, count: ids.size }));

  return { years: rows(years), alphabet: rows(letters) };
}
