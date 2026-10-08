import type { Album, Artist } from "./types";
export interface Snapshot {
  artists: Artist[];
  albums: Album[];
  server: string;
  accountId: string;
  scannedAt: number;
  cachedAt?: string;
}
export interface Annotation {
  reference: string;
  loved: boolean;
  rating: number | null;
  note: string | null;
  tags: string[];
}
export interface Track {
  reference: string;
  title: string;
  duration_ms: number | null;
  analyses: unknown[];
  analysis_available?: boolean;
  path?: string;
}
export interface AccountSession {
  server: string;
  account: { id: string; username: string; role: string };
}
const regions = new Intl.DisplayNames(["fr"], { type: "region" });
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Réponse Aède invalide.");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Champ Aède invalide.");
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    throw new Error("Liste Aède invalide.");
  return value as string[];
}
function relations(value: unknown): NonNullable<Artist["relations"]> {
  if (!Array.isArray(value)) throw new Error("Relations Aède invalides.");
  return value.map((value) => {
    const row = object(value);
    if (!Number.isSafeInteger(row.weight) || Number(row.weight) < 0)
      throw new Error("Poids de relation Aède invalide.");
    return {
      reference: string(row.reference),
      name: string(row.name),
      weight: Number(row.weight),
      kind: string(row.kind),
      source: string(row.source),
    };
  });
}
/** Reject malformed snapshots instead of silently hiding entities or inventing origins. */
export function parseSnapshot(value: unknown): Snapshot {
  const snapshot = object(value);
  if (!Array.isArray(snapshot.artists) || !Array.isArray(snapshot.albums))
    throw new Error("Catalogue Aède invalide.");
  const artists = snapshot.artists.map((value) => {
    const row = object(value);
    const code =
      typeof row.country_code === "string" && /^[A-Z]{2}$/.test(row.country_code)
        ? row.country_code
        : undefined;
    const media = object(row.media ?? {});
    const credit = row.biography_credit ? object(row.biography_credit) : undefined;
    const artist: Artist = {
      reference: string(row.reference),
      name: string(row.name),
      genre: string(row.genre),
      genres: strings(row.genres ?? []),
      country: code
        ? (regions.of(code) ?? code)
        : row.country === null
          ? null
          : string(row.country),
      biography: string(row.biography),
      artwork: false,
      releaseRefs: strings(row.release_refs ?? []),
      searchFields: strings(row.search_fields ?? []),
      media: {
        banner: media.banner === true,
        background: media.background === true,
        portrait: media.portrait === true,
      },
      relations: relations(row.relations ?? []),
    };
    if (code) artist.countryCode = code;
    if (credit)
      artist.biographyCredit = {
        url: string(credit.url),
        lang: string(credit.lang),
        licence: string(credit.licence),
      };
    return artist;
  });
  const albums = snapshot.albums.map((value) => {
    const row = object(value);
    if (
      row.year !== null &&
      (!Number.isInteger(row.year) || Number(row.year) < 1 || Number(row.year) > 9999)
    )
      throw new Error("Année Aède invalide.");
    if (row.added_at != null && (!Number.isSafeInteger(row.added_at) || Number(row.added_at) < 0))
      throw new Error("Date d’ajout Aède invalide.");
    return {
      addedAt: row.added_at == null ? null : Number(row.added_at),
      reference: string(row.reference),
      artist: row.artist === null ? null : string(row.artist),
      title: string(row.title),
      year: row.year as number | null,
      compilation: row.compilation === true,
      tags: strings(row.tags),
      contributors: strings(row.contributors ?? []),
      cover: row.cover === true,
      trackCount: Number(row.track_count),
      searchFields: strings(row.search_fields ?? []),
    } satisfies Album;
  });
  for (const rows of [artists, albums])
    if (new Set(rows.map((row) => row.reference)).size !== rows.length)
      throw new Error("Références Aède dupliquées.");
  return {
    artists,
    albums,
    server: string(snapshot.server),
    accountId: string(snapshot.accountId),
    scannedAt: Number(snapshot.scannedAt),
    ...(typeof snapshot.cachedAt === "string" ? { cachedAt: snapshot.cachedAt } : {}),
  };
}
/** Only validated attributed web links may be made clickable. */
export function sourceLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
