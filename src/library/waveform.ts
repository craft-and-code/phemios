import { t } from "../i18n";
export interface Waveform {
  reference: string;
  duration_ms: number;
  sample_rate: number;
  bucket_frames: number;
  peaks: number[];
}
/** Only complete, attributed bounded envelopes may represent a track's timeline. */
export function parseWaveform(raw: unknown, reference: string): Waveform {
  const row = raw as Waveform;
  if (
    !row ||
    row.reference !== reference ||
    !Number.isSafeInteger(row.duration_ms) ||
    row.duration_ms <= 0 ||
    row.duration_ms > 86400000 ||
    !Number.isInteger(row.sample_rate) ||
    row.sample_rate < 8000 ||
    row.sample_rate > 768000 ||
    !Number.isSafeInteger(row.bucket_frames) ||
    row.bucket_frames <= 0 ||
    !Array.isArray(row.peaks) ||
    !row.peaks.length ||
    row.peaks.length > 2048 ||
    row.peaks.some((peak) => !Number.isFinite(peak) || peak < 0 || peak > 1)
  )
    throw new Error(t("Forme d’onde invalide."));
  const span = (row.peaks.length * row.bucket_frames * 1000) / row.sample_rate;
  if (
    span < row.duration_ms ||
    span - row.duration_ms > (row.bucket_frames * 1000) / row.sample_rate + 1
  )
    throw new Error(t("Forme d’onde invalide."));
  return row;
}
/** Bucket positions follow decoded frames, including the shorter final bucket. */
export function waveformPath(waveform: Waveform): string {
  return waveform.peaks
    .map((peak, index) => {
      const x = Math.min(
          999,
          ((index * waveform.bucket_frames * 1000) / waveform.sample_rate / waveform.duration_ms) *
            1000,
        ),
        y = Math.max(0.5, peak * 18);
      return `M${x.toFixed(2)} ${(20 - y).toFixed(2)}V${(20 + y).toFixed(2)}`;
    })
    .join("");
}

/** A pointer addresses the full SVG width; native range thumbs have a shorter travel. */
export function waveformPosition(x: number, left: number, width: number, duration: number): number {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(duration) || duration <= 0)
    return 0;
  return Math.round(Math.max(0, Math.min(1, (x - left) / width)) * duration);
}
