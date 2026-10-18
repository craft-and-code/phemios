import { t } from "../i18n";
import type { PlayableSelection } from "../library/playback-selection";
/** Session-only optical track references cannot be confused with Aède entities. */
export function cdReference(reference: string): { token: string; number: number } | undefined {
  const match = /^track:cd\/([0-9a-f]{16})\/([1-9][0-9]?)$/.exec(reference);
  return match?.[1] && match[2] ? { token: match[1], number: Number(match[2]) } : undefined;
}
/** No path, credential, invented album metadata or imported catalogue fact is carried by this DTO. */
export interface CdDisc {
  token: string;
  title?: string | null;
  artist?: string | null;
  tracks: {
    reference: string;
    number: number;
    duration_ms: number;
    title?: string | null;
    artist?: string | null;
  }[];
}
/** An inserted disc remains distinct from a physically present empty/inaccessible drive. */
export interface CdDrive {
  id: string;
  name: string;
  image?: boolean;
  error: string | null;
  disc: CdDisc | null;
}
/** Admit the complete bounded native result before replacing a visible drive list. */
export function parseCd(value: unknown): CdDrive[] {
  const rows = (value as { drives?: unknown } | null)?.drives;
  const error = () => new Error(t("Réponse des lecteurs CD invalide."));
  if (!Array.isArray(rows) || rows.length > 16) throw error();
  const validText = (value: unknown) =>
    value == null || (typeof value === "string" && value.length <= 1000);
  const ids = new Set<string>(),
    tokens = new Set<string>();
  return rows.map((row: CdDrive) => {
    if (
      !row ||
      typeof row.id !== "string" ||
      !/^[0-9a-f]{16}$/.test(row.id) ||
      ids.has(row.id) ||
      (row.image !== undefined && typeof row.image !== "boolean") ||
      typeof row.name !== "string" ||
      !row.name ||
      row.name.length > 200 ||
      (row.error !== null && typeof row.error !== "string")
    )
      throw error();
    ids.add(row.id);
    if (row.disc !== null) {
      const disc = row.disc;
      if (
        !disc ||
        typeof disc.token !== "string" ||
        !/^[0-9a-f]{16}$/.test(disc.token) ||
        tokens.has(disc.token) ||
        !validText(disc.title) ||
        !validText(disc.artist) ||
        !Array.isArray(disc.tracks) ||
        !disc.tracks.length ||
        disc.tracks.length > 99
      )
        throw error();
      tokens.add(disc.token);
      const numbers = new Set<number>();
      for (const track of disc.tracks) {
        const reference =
          typeof track?.reference === "string" ? cdReference(track.reference) : undefined;
        if (
          !reference ||
          !validText(track.title) ||
          !validText(track.artist) ||
          reference.token !== disc.token ||
          reference.number !== track.number ||
          numbers.has(track.number) ||
          !Number.isSafeInteger(track.duration_ms) ||
          track.duration_ms <= 0 ||
          track.duration_ms > 7_200_000
        )
          throw error();
        numbers.add(track.number);
      }
    }
    return row;
  });
}
/** A CD enters the ordinary logical queue without publishing a release or guessing track titles. */
export function cdSelection(disc: CdDisc): PlayableSelection[] {
  return disc.tracks.map((track, index) => ({
    reference: track.reference,
    title: track.title || t("Piste {0}", track.number),
    artist: track.artist || disc.artist || t("CD audio"),
    album: null,
    number: index + 1,
    albumTotal: disc.tracks.length,
    durationMs: track.duration_ms,
  }));
}

/** Translate the application-owned prefix while preserving OS diagnostic text verbatim. */
export function cdError(message: string): string {
  const prefix = "CD absent ou inaccessible : ";
  return message.startsWith(prefix)
    ? t("CD absent ou inaccessible : {0}", message.slice(prefix.length))
    : t(message);
}

/** Only the selected physical disc blocks its own ejection while audio is starting/playing. */
export function cdPlaying(token: string | undefined, reference: string, status: string): boolean {
  return (
    !!token && cdReference(reference)?.token === token && ["playing", "connecting"].includes(status)
  );
}
