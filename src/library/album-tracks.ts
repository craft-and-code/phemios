import { requestAede } from "../platform/desktop";
import type { Track } from "./server";
export interface AlbumTrack extends Track {
  disc_no: number | null;
  track_no: number | null;
  album_position: number;
  analysis_available: boolean;
  spectrum_available: boolean;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Page de pistes Aède invalide.");
  return value as Record<string, unknown>;
};
const ordinal = (value: unknown) =>
  value === null ||
  (Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff);
/** Fetch lightweight album-order pages; analyses are loaded only when explicitly expanded. */
export async function albumTracks(reference: string): Promise<AlbumTrack[]> {
  const tracks: AlbumTrack[] = [],
    seen = new Set<string>();
  let total: number | undefined, stamp: number | undefined;
  do {
    const page = object(
      await requestAede("/api/v1/presentation/tracks", {
        ref: reference,
        offset: String(tracks.length),
        limit: "50",
      }),
    );
    if (
      !Number.isSafeInteger(page.total) ||
      Number(page.total) < 0 ||
      Number(page.total) > 4096 ||
      !Number.isSafeInteger(page.scanned_at) ||
      Number(page.scanned_at) < 0
    )
      throw new Error("Page de pistes invalide ou album supérieur à 4096 pistes.");
    if (
      (total !== undefined && total !== page.total) ||
      (stamp !== undefined && stamp !== page.scanned_at)
    )
      throw new Error("Le catalogue a changé ; resynchronisez la bibliothèque.");
    total = Number(page.total);
    stamp = Number(page.scanned_at);
    if (
      page.offset !== tracks.length ||
      !Array.isArray(page.items) ||
      page.items.length !== Math.min(50, total - tracks.length)
    )
      throw new Error("Page de pistes incomplète.");
    for (const value of page.items) {
      const row = object(value);
      if (!("disc_no" in row) || !("track_no" in row) || !("album_position" in row))
        throw new Error(
          "Mettez à jour puis redémarrez Aède pour afficher les disques de cet album.",
        );
      if (
        typeof row.reference !== "string" ||
        !row.reference.startsWith("track:") ||
        seen.has(row.reference) ||
        typeof row.title !== "string" ||
        !ordinal(row.disc_no) ||
        !ordinal(row.track_no) ||
        row.album_position !== tracks.length + 1 ||
        (row.duration_ms !== null &&
          (!Number.isSafeInteger(row.duration_ms) || Number(row.duration_ms) < 0)) ||
        typeof row.analysis_available !== "boolean" ||
        typeof row.spectrum_available !== "boolean"
      )
        throw new Error("Position ou piste Aède invalide ; resynchronisez la bibliothèque.");
      seen.add(row.reference);
      tracks.push({
        reference: row.reference,
        title: row.title,
        disc_no: row.disc_no as number | null,
        track_no: row.track_no as number | null,
        album_position: tracks.length + 1,
        duration_ms: row.duration_ms as number | null,
        analysis_available: row.analysis_available,
        spectrum_available: row.spectrum_available,
        analyses: [],
      });
    }
  } while (tracks.length < total);
  return tracks;
}
/** Preserve server queue order and absolute play indices, including identical titles on different CDs. */
export function discGroups(tracks: readonly AlbumTrack[]) {
  const groups: {
    disc: number | null;
    tracks: { track: AlbumTrack; index: number; number: number }[];
  }[] = [];
  tracks.forEach((track, index) => {
    let group = groups[groups.length - 1];
    if (!group || group.disc !== track.disc_no) {
      group = { disc: track.disc_no, tracks: [] };
      groups.push(group);
    }
    group.tracks.push({ track, index, number: track.track_no ?? group.tracks.length + 1 });
  });
  return groups;
}
