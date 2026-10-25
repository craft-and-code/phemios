import type { Waveform } from "../library/waveform";
import { cdReference } from "./model";
/** Unread CD regions remain null; optional metadata cannot substitute another source's envelope. */
export function parseCdWaveform(
  raw: unknown,
  reference: string,
  duration: number | null,
): Waveform {
  const value = raw as Waveform;
  if (
    !value ||
    !cdReference(reference) ||
    value.reference !== reference ||
    !Number.isSafeInteger(value.duration_ms) ||
    value.duration_ms <= 0 ||
    value.duration_ms > 7200000 ||
    value.duration_ms !== duration ||
    value.sample_rate !== 44100 ||
    !Number.isSafeInteger(value.bucket_frames) ||
    value.bucket_frames <= 0 ||
    !Array.isArray(value.peaks) ||
    !value.peaks.length ||
    value.peaks.length > 1024 ||
    value.peaks.some(
      (peak) =>
        peak !== null &&
        (!Number.isFinite(peak) || typeof peak !== "number" || peak < 0 || peak > 1),
    )
  )
    throw new Error("Invalid progressive CD waveform.");
  const span = (value.peaks.length * value.bucket_frames * 1000) / 44100;
  if (
    span < value.duration_ms ||
    span - value.duration_ms > (value.bucket_frames * 1000) / 44100 + 1
  )
    throw new Error("Invalid progressive CD waveform.");
  return value;
}
