import { t } from "../i18n";
import type { Album, Artist } from "./types";
export interface TagCard {
  reference: string;
  label: string;
  kind: "artist" | "album" | "track";
  cover: string | null;
}
/** Uniform cards keep directly tagged targets distinct, including contributor-only artists. */
export function cachedTagCard(
  reference: string,
  artists: readonly Artist[],
  albums: readonly Album[],
): TagCard | undefined {
  const artist = artists.find((row) => row.reference === reference);
  if (artist)
    return {
      reference,
      label: artist.name,
      kind: "artist",
      cover: albums.find((album) => album.artist === reference)?.reference ?? null,
    };
  const album = albums.find((row) => row.reference === reference);
  if (album) return { reference, label: album.title, kind: "album", cover: reference };
  return undefined;
}
/** A missing cached target is resolved by its exact owner-qualified identity, never hidden or inferred. */
export function parseTagCard(value: unknown, reference: string): TagCard {
  const row = value as Record<string, unknown>;
  const kind = reference.startsWith("artist:")
    ? "artist"
    : reference.startsWith("release:")
      ? "album"
      : reference.startsWith("track:")
        ? "track"
        : undefined;
  if (
    !row ||
    typeof row !== "object" ||
    row.reference !== reference ||
    !kind ||
    typeof (row.name ?? row.title) !== "string"
  )
    throw new Error(t("Élément tagué indisponible."));
  return {
    reference,
    label: String(row.name ?? row.title),
    kind,
    cover:
      kind === "album"
        ? reference
        : kind === "track" && typeof row.release === "string"
          ? row.release
          : null,
  };
}
