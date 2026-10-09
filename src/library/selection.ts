import type { Album, Artist, Filters } from "./types";
/** A detail year opens all albums from that year, independent of stale browse facets. */
export function selectAlbumYear(previous: Filters, year: number): Filters {
  return {
    ...previous,
    mode: "years",
    years: [year, year],
    alphabet: [0, 26],
    includeUnknownYear: false,
    query: "",
    countries: [],
    genre: undefined,
    genres: [],
  };
}
/** Visible album artists use Aède's canonical release association, not personnel roles. */
export function browseArtists(artists: readonly Artist[], albums: readonly Album[]) {
  const principals = new Set(albums.map((album) => album.artist).filter(Boolean));
  return artists.filter((artist) => principals.has(artist.reference));
}
/** Ordinary activation replaces; additive activation toggles one country in a union. */
export function selectCountries(
  current: readonly (string | null)[],
  value: string | null | undefined,
  additive: boolean,
): readonly (string | null)[] {
  if (value === undefined) return [];
  if (!additive) return [value];
  return current.includes(value)
    ? current.filter((country) => country !== value)
    : [...current, value];
}
/** Command is the platform modifier on Mac; Control is used elsewhere. */
export function additiveCountrySelection(
  event: { metaKey: boolean; ctrlKey: boolean },
  mac: boolean,
): boolean {
  return mac ? event.metaKey : event.ctrlKey;
}
export const isMac = () => /Mac/i.test(navigator.platform);
