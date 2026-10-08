import type { Album, Artist } from "./types";
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
