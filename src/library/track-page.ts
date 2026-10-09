import { t } from "../i18n";
import type { Track } from "./server";
export interface CatalogTrack extends Track {
  release: string | null;
  album_title: string | null;
  disc_no: number | null;
  track_no: number | null;
  album_position: number | null;
  spectrum_available: boolean;
}
export const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(t("Piste Aède invalide."));
  return v as Record<string, unknown>;
};
const nonnegative = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const ordinal = (v: unknown) => v === null || (nonnegative(v) && v <= 0xffffffff);
/** Validate server windows and stable track identities, including tracks outside any release. */
export function parseTrackPage(value: unknown, offset: number) {
  const p = record(value);
  if (
    !nonnegative(p.total) ||
    !nonnegative(p.scanned_at) ||
    p.offset !== offset ||
    p.limit !== 50 ||
    !Array.isArray(p.items) ||
    p.items.length !== Math.max(0, Math.min(50, p.total - offset))
  )
    throw new Error(t("Page de pistes Aède incomplète ou modifiée."));
  const items = p.items.map(parseCatalogTrack);
  if (new Set(items.map((r) => r.reference)).size !== items.length)
    throw new Error(t("Pistes Aède dupliquées."));
  return { items, total: p.total, scannedAt: p.scanned_at };
}
/** Shared lightweight row validation; full analysis payloads are fetched separately. */
export function parseCatalogTrack(value: unknown): CatalogTrack {
  const r = record(value);
  if (
    typeof r.reference !== "string" ||
    !/^track:.+/.test(r.reference) ||
    typeof r.title !== "string" ||
    !(r.release === null || (typeof r.release === "string" && /^release:.+/.test(r.release))) ||
    !(r.album_title === null || typeof r.album_title === "string") ||
    !ordinal(r.disc_no) ||
    !ordinal(r.track_no) ||
    !(r.album_position === null || (nonnegative(r.album_position) && r.album_position > 0)) ||
    !(r.duration_ms === null || nonnegative(r.duration_ms)) ||
    typeof r.analysis_available !== "boolean" ||
    typeof r.spectrum_available !== "boolean"
  )
    throw new Error(t("Piste Aède invalide ; mettez à jour puis redémarrez le serveur."));
  return {
    reference: r.reference,
    title: r.title,
    release: r.release as string | null,
    album_title: r.album_title as string | null,
    disc_no: r.disc_no as number | null,
    track_no: r.track_no as number | null,
    album_position: r.album_position as number | null,
    duration_ms: r.duration_ms as number | null,
    analysis_available: r.analysis_available,
    spectrum_available: r.spectrum_available,
    analyses: [],
  };
}
