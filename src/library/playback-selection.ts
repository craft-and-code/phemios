import type { Album, Artist } from "./types";
export interface PlayableSelection {
  reference: string;
  title: string;
  album: Album;
  artist: string;
  number: number;
  albumTotal: number;
}
/** Resolve server-ordered stable references without guessing missing editions or positions. */
export function playbackSelection(
  value: unknown,
  albums: readonly Album[],
  artists: readonly Artist[],
): PlayableSelection[] {
  if (!value || typeof value !== "object") throw new Error("Sélection Aède invalide.");
  const rows = (value as { items?: unknown }).items;
  if (!Array.isArray(rows) || !rows.length || rows.length > 4096)
    throw new Error("Sélection vide ou supérieure à 4096 pistes.");
  const releases = new Map(albums.map((a) => [a.reference, a]));
  return rows.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Piste Aède invalide.");
    const r = value as Record<string, unknown>,
      album = releases.get(String(r.release));
    if (
      !album ||
      typeof r.reference !== "string" ||
      !r.reference.startsWith("track:") ||
      typeof r.title !== "string" ||
      !Number.isSafeInteger(r.number) ||
      !Number.isSafeInteger(r.album_total) ||
      Number(r.number) < 1 ||
      Number(r.number) > Number(r.album_total)
    )
      throw new Error("Sélection modifiée ; resynchronisez la bibliothèque.");
    return {
      reference: r.reference,
      title: r.title,
      album,
      artist: artists.find((a) => a.reference === album.artist)?.name ?? "Artistes divers",
      number: Number(r.number),
      albumTotal: Number(r.album_total),
    };
  });
}
