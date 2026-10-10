import { normalizeName } from "./filtering";
import { missingAlbum, type MissingAlbum } from "./missing";
import type { Album } from "./types";
export interface AlbumEntry {
  album: Album;
  missing?: MissingAlbum;
}
/** Discographies interleave attributed gaps by year; ordinary lists retain their caller's order. */
export function albumEntries(
  albums: readonly Album[],
  missing: readonly MissingAlbum[] = [],
  chronological = false,
  reverse = false,
): AlbumEntry[] {
  const entries: AlbumEntry[] = [
    ...albums.map((album) => ({ album })),
    ...missing.map((row) => ({ album: missingAlbum(row), missing: row })),
  ];
  if (!chronological && !missing.length) return entries;
  return entries.sort((a, b) => {
    if (chronological && (a.album.year === null || b.album.year === null)) {
      if (a.album.year !== b.album.year) return a.album.year === null ? 1 : -1;
    }
    const years = chronological
      ? ((a.album.year ?? 0) - (b.album.year ?? 0)) * (reverse ? -1 : 1)
      : 0;
    return (
      (Number.isNaN(years) ? 0 : years) ||
      normalizeName(a.album.title).localeCompare(normalizeName(b.album.title)) *
        (reverse ? -1 : 1) ||
      a.album.reference.localeCompare(b.album.reference)
    );
  });
}
