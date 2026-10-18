import { matchesAlphabet, normalizeName } from "./filtering";
import type { CatalogTrack } from "./track-page";
import type { Filters, Album } from "./types";
/** Dynamic criteria keep track membership on Aède instead of expanding matching albums. */
export function trackCollectionExpression(filters: Filters, reverse = false): string {
  return `browse-v1:${JSON.stringify({
    view: "tracks",
    mode: filters.mode,
    years: filters.years,
    alphabet: filters.alphabet,
    includeUnknownYear: filters.includeUnknownYear,
    query: filters.query,
    reverse,
  })}`;
}
/** Offline projections use only retained titles and edition years; unknown facts remain explicit. */
export function trackBrowseRows(
  tracks: readonly CatalogTrack[],
  albums: readonly Pick<Album, "reference" | "year">[],
  filters: Filters,
) {
  const years = new Map(albums.map((album) => [album.reference, album.year]));
  const term = normalizeName(filters.query);
  return tracks.filter((track) => {
    const year = years.get(track.release ?? "") ?? null;
    return (
      matchesAlphabet(track.title, filters) &&
      (!["years", "both"].includes(filters.mode) ||
        (year === null
          ? filters.includeUnknownYear
          : year >= filters.years[0] && year <= filters.years[1])) &&
      (!term ||
        [track.title, track.album_title ?? ""].some((value) => normalizeName(value).includes(term)))
    );
  });
}
export function trackBrowsePage(
  tracks: readonly CatalogTrack[],
  albums: readonly Pick<Album, "reference" | "year">[],
  filters: Filters,
  reverse: boolean,
  offset: number,
) {
  const rows = trackBrowseRows(tracks, albums, filters);
  if (reverse) rows.reverse();
  return { items: rows.slice(offset, offset + 50), total: rows.length };
}
