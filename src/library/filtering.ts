import { isRecentAlbum } from "./recent-albums";
import { t } from "../i18n";
import { catalogIndex } from "./index";
import type { Album, Artist, Filters, Interval } from "./types";

/** Accent/case/Latin-ligature folding used only for presentation search. */
export function normalizeName(value: string): string {
  return value
    .trim()
    .replaceAll(/œ/gi, "oe")
    .replaceAll(/æ/gi, "ae")
    .replaceAll(/ø/gi, "o")
    .replaceAll(/ł/gi, "l")
    .replaceAll(/[đð]/gi, "d")
    .replaceAll(/ß/gi, "ss")
    .replaceAll(/þ/gi, "th")
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
    throw new Error(t("The selected interval is outside its domain."));
  }
  const shift = Math.max(domain[0] - range[0], Math.min(Math.round(delta), domain[1] - range[1]));
  return [range[0] + shift, range[1] + shift];
}

/** Inclusive year matching; unknown years remain an explicit opt-in. */
export function matchesYear(album: Album, filters: Filters): boolean {
  if (["alphabet", "none"].includes(filters.mode)) return true;
  return album.year === null
    ? filters.includeUnknownYear
    : album.year >= filters.years[0] && album.year <= filters.years[1];
}

/** Alphabet intervals apply to the entity names in the current list. */
export function matchesAlphabet(name: string, filters: Filters): boolean {
  if (["years", "none"].includes(filters.mode)) return true;
  const index = initialIndex(name);
  return index >= filters.alphabet[0] && index <= filters.alphabet[1];
}

const albumText = new WeakMap<Album, string>(),
  artistText = new WeakMap<Artist, string>();
function searchableArtist(artist: Artist): string {
  let text = artistText.get(artist);
  if (text !== undefined) return text;
  text = normalizeName(
    [
      artist.name,
      artist.genre,
      artist.country ?? "",
      artist.biography,
      ...(artist.searchFields ?? []),
    ].join(" "),
  );
  artistText.set(artist, text);
  return text;
}
function searchableAlbum(album: Album): string {
  let text = albumText.get(album);
  if (text !== undefined) return text;
  text = normalizeName(
    [
      album.title,
      album.year ?? "",
      ...album.tags,
      ...(album.searchFields ?? []),
      album.note ?? "",
      album.rating ?? "",
      album.favourite ? "favori" : "",
    ].join(" "),
  );
  albumText.set(album, text);
  return text;
}
/** Search indexes cover supplied tags, fetched presentation fields and loaded own annotations. */
export function searchAlbum(album: Album, artist: Artist | undefined, query: string): boolean {
  const term = normalizeName(query);
  return (
    !term ||
    searchableAlbum(album).includes(term) ||
    (artist !== undefined && searchableArtist(artist).includes(term))
  );
}
export function searchArtist(artist: Artist, query: string): boolean {
  const term = normalizeName(query);
  return !term || searchableArtist(artist).includes(term);
}

/** Facets remain visible in the filter bar when the navigation view changes. */
export function matchesFacets(artist: Artist, filters: Filters): boolean {
  const genres = selectedGenres(filters);
  return (
    (!filters.countries?.length || filters.countries.includes(artist.country)) &&
    (!genres.length ||
      genres.some((genre) => artist.genre === genre || artist.genres?.includes(genre) === true))
  );
}

/** Contributions retain the credited artist without changing an album's primary artist. */
export function belongsToArtist(album: Album, artist: Artist): boolean {
  return (
    album.artist === artist.reference ||
    album.contributors?.includes(artist.reference) === true ||
    artist.releaseRefs?.includes(album.reference) === true
  );
}

/** Artist year matching uses its releases; alphabet matching uses its own name. */
export function filterArtists(
  artists: readonly Artist[],
  albums: readonly Album[],
  filters: Filters,
) {
  const index = catalogIndex(artists, albums);
  return artists.filter((artist) => {
    if (!matchesFacets(artist, filters) || !matchesAlphabet(artist.name, filters)) return false;
    const releases = index.albumsByArtist.get(artist.reference) ?? [];
    return releases.length
      ? releases.some(
          (album) => matchesYear(album, filters) && searchAlbum(album, artist, filters.query),
        )
      : (["alphabet", "none"].includes(filters.mode) || filters.includeUnknownYear) &&
          searchArtist(artist, filters.query);
  });
}

/** Album filtering never mutates the catalog and preserves each edition. */
export function filterAlbums(
  albums: readonly Album[],
  artists: readonly Artist[],
  filters: Filters,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const index = catalogIndex(artists, albums);
  return albums.filter((album) => {
    if (filters.recentOnly && !isRecentAlbum(album, nowSeconds)) return false;
    if (!matchesComposers(album, filters)) return false;
    const related = index.artistsByAlbum.get(album.reference) ?? [];
    const fallback: Artist = {
      reference: "",
      name: t("Artistes divers"),
      genre: "",
      country: null,
      biography: "",
      artwork: false,
    };
    return (
      matchesYear(album, filters) &&
      matchesAlphabet(album.title, filters) &&
      (related.length
        ? related.some(
            (artist) => matchesFacets(artist, filters) && searchAlbum(album, artist, filters.query),
          )
        : !filters.countries?.length &&
          !selectedGenres(filters).length &&
          searchAlbum(album, fallback, filters.query))
    );
  });
}

/** Legacy scalar and current multi-selection share union semantics. */
export function selectedGenres(filters: Filters): readonly string[] {
  return [...new Set([...(filters.genres ?? []), ...(filters.genre ? [filters.genre] : [])])];
}

/** A union of exact, source-qualified composer identities; never inferred from album artists. */
export function matchesComposers(album: Album, filters: Filters): boolean {
  return (
    !filters.composers?.length ||
    filters.composers.some((reference) => album.composers?.includes(reference))
  );
}
