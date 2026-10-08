import type { Album, Artist, Filters, Interval } from "./types";

/** Accent/case/Latin-ligature folding used only for presentation search. */
export function normalizeName(value: string): string {
  return value
    .trim()
    .replaceAll(/œ/gi, "oe")
    .replaceAll(/æ/gi, "ae")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("fr");
}

/** Nonletter or empty initials belong to the explicit # bucket. */
export function initialIndex(name: string): number {
  const first = normalizeName(name).charCodeAt(0);
  return first >= 65 && first <= 90 ? first - 64 : 0;
}

/** Shift an interval without resizing it, clamping at either domain edge. */
export function shiftInterval(range: Interval, delta: number, domain: Interval): Interval {
  if (
    ![...range, ...domain, delta].every(Number.isFinite) ||
    range[0] > range[1] ||
    domain[0] > domain[1] ||
    range[0] < domain[0] ||
    range[1] > domain[1]
  ) {
    throw new Error("The selected interval is outside its domain.");
  }
  const shift = Math.max(domain[0] - range[0], Math.min(Math.round(delta), domain[1] - range[1]));
  return [range[0] + shift, range[1] + shift];
}

/** Inclusive year matching; unknown years remain an explicit opt-in. */
export function matchesYear(album: Album, filters: Filters): boolean {
  if (filters.mode === "alphabet") return true;
  return album.year === null
    ? filters.includeUnknownYear
    : album.year >= filters.years[0] && album.year <= filters.years[1];
}

/** Alphabet intervals apply to the entity names in the current list. */
export function matchesAlphabet(name: string, filters: Filters): boolean {
  if (filters.mode === "years") return true;
  const index = initialIndex(name);
  return index >= filters.alphabet[0] && index <= filters.alphabet[1];
}

/** Search all fields supplied to this preview; backend broad search is separate. */
export function searchAlbum(album: Album, artist: Artist, query: string): boolean {
  const text = [
    album.title,
    album.year ?? "",
    ...album.tags,
    artist.name,
    artist.genre,
    artist.country ?? "",
    artist.biography,
  ].join(" ");
  return normalizeName(text).includes(normalizeName(query));
}

/** Facets remain visible in the filter bar when the navigation view changes. */
export function matchesFacets(artist: Artist, filters: Filters): boolean {
  return (
    (filters.country === undefined || artist.country === filters.country) &&
    (filters.genre === undefined || artist.genre === filters.genre)
  );
}

/** Artist year matching uses its releases; alphabet matching uses its own name. */
export function filterArtists(
  artists: readonly Artist[],
  albums: readonly Album[],
  filters: Filters,
) {
  return artists.filter(
    (artist) =>
      matchesFacets(artist, filters) &&
      matchesAlphabet(artist.name, filters) &&
      albums.some(
        (album) =>
          album.artist === artist.reference &&
          matchesYear(album, filters) &&
          searchAlbum(album, artist, filters.query),
      ),
  );
}

/** Album filtering never mutates the catalog and preserves each edition. */
export function filterAlbums(
  albums: readonly Album[],
  artists: readonly Artist[],
  filters: Filters,
) {
  return albums.filter((album) => {
    const artist = artists.find((candidate) => candidate.reference === album.artist);
    return (
      artist !== undefined &&
      matchesFacets(artist, filters) &&
      matchesYear(album, filters) &&
      matchesAlphabet(album.title, filters) &&
      searchAlbum(album, artist, filters.query)
    );
  });
}
