import { record } from "./track-page";
import type { Track } from "./server";
export interface TrackDetail extends Track {
  release: string | null;
  disc_no: number | null;
  track_no: number | null;
  size: number;
  spectrum_available: boolean;
  properties: {
    codec: string;
    container: string;
    sample_rate: number | null;
    bit_depth: number | null;
    channels: number | null;
    bitrate_kbps: number | null;
    lossless: boolean | null;
  };
  tags: Record<string, string[]>;
  credits: { reference: string; name: string; role: string; source: string }[];
}
/** Validate the attributed metadata returned by Aède's track detail, without inference. */
export function parseTrackDetail(value: unknown, reference: string): TrackDetail {
  const r = record(value),
    p = record(r.properties),
    tags = record(r.tags);
  const integer = (v: unknown) => v === null || (Number.isSafeInteger(v) && Number(v) >= 0);
  if (
    r.reference !== reference ||
    typeof r.title !== "string" ||
    !(r.release === null || (typeof r.release === "string" && r.release.startsWith("release:"))) ||
    !integer(r.duration_ms) ||
    !integer(r.disc_no) ||
    !integer(r.track_no) ||
    !Number.isSafeInteger(r.size) ||
    Number(r.size) < 0 ||
    typeof r.spectrum_available !== "boolean" ||
    !Array.isArray(r.analyses) ||
    !Array.isArray(r.credits) ||
    typeof p.codec !== "string" ||
    typeof p.container !== "string" ||
    ![p.sample_rate, p.bit_depth, p.channels, p.bitrate_kbps].every(integer) ||
    !(p.lossless === null || typeof p.lossless === "boolean") ||
    !Object.values(tags).every((v) => Array.isArray(v) && v.every((s) => typeof s === "string"))
  )
    throw new Error("Détail de piste invalide ; mettez à jour puis redémarrez Aède.");
  for (const v of r.credits) {
    const c = record(v);
    if (
      typeof c.reference !== "string" ||
      !c.reference.startsWith("artist:") ||
      ![c.name, c.role, c.source].every((v) => typeof v === "string")
    )
      throw new Error("Crédit Aède invalide.");
  }
  return r as unknown as TrackDetail;
}
