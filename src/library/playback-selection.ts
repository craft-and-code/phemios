import { t } from "../i18n";
import type { Album, Artist } from "./types";
export interface PlayableSelection {
  reference: string;
  title: string;
  album: Album | null;
  artist: string;
  /** Known duration for temporary native sources outside the catalogue. */
  durationMs?: number;
  number: number;
  albumTotal: number;
}
/** Resolve server-ordered stable references without guessing missing editions or positions. */
export function playbackSelection(
  value: unknown,
  albums: readonly Album[],
  artists: readonly Artist[],
): PlayableSelection[] {
  if (!value || typeof value !== "object") throw new Error(t("Sélection Aède invalide."));
  const rows = (value as { items?: unknown }).items;
  if (!Array.isArray(rows) || !rows.length || rows.length > 4096)
    throw new Error(t("Sélection vide ou supérieure à 4096 pistes."));
  const releases = new Map(albums.map((a) => [a.reference, a]));
  const artistNames = new Map<string, string>();
  for (const artist of artists)
    if (!artistNames.has(artist.reference)) artistNames.set(artist.reference, artist.name);
  return rows.map((value) => {
    if (!value || typeof value !== "object") throw new Error(t("Piste Aède invalide."));
    const r = value as Record<string, unknown>,
      album = r.release === null ? null : releases.get(String(r.release));
    if (
      album === undefined ||
      typeof r.reference !== "string" ||
      !r.reference.startsWith("track:") ||
      typeof r.title !== "string" ||
      !Number.isSafeInteger(r.number) ||
      !Number.isSafeInteger(r.album_total) ||
      Number(r.number) < 1 ||
      Number(r.number) > Number(r.album_total)
    )
      throw new Error(t("Sélection modifiée ; resynchronisez la bibliothèque."));
    return {
      reference: r.reference,
      title: r.title,
      album,
      artist:
        artistNames.get(album?.artist ?? "") ??
        (album ? t("Artistes divers") : t("Titre sans album")),
      number: Number(r.number),
      albumTotal: Number(r.album_total),
    };
  });
}

/** Track additions admit exactly one matching identity; album/artist and explicit lists retain their order. */
export function queueAdditionSelection(
  value: unknown,
  albums: readonly Album[],
  artists: readonly Artist[],
  reference?: string,
): PlayableSelection[] {
  const rows = playbackSelection(value, albums, artists);
  if (!reference?.startsWith("track:")) return rows;
  const matching = rows.filter((row) => row.reference === reference);
  if (matching.length !== 1)
    throw new Error(t("Sélection modifiée ; resynchronisez la bibliothèque."));
  return matching;
}
