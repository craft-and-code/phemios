import { t } from "../i18n";
/** Public native playback state. Its clock counts source frames consumed by the callback. */
export interface PlaybackState {
  /** Physical CD playback never inherits a remote account/reference namespace. */
  source?: "aede" | "cd";
  spectrum?: readonly number[];
  spectrum_hz?: readonly number[];
  shuffled: boolean;
  repeat: "off" | "one" | "all";
  queue: readonly number[];
  protected_occurrences?: readonly number[];
  status: "idle" | "connecting" | "playing" | "paused" | "ended" | "error";
  reference: string;
  index: number;
  /** Slot bound for stable occurrence ids; visible queue size is queue.length. */
  total: number;
  position_ms: number;
  duration_ms: number | null;
  sample_rate: number;
  volume: number;
  history_confirmed: boolean;
  device: string;
  error: string;
  seek_id: number;
  queue_id: number;
  level: number;
  levels: readonly number[];
}
export interface AudioOutput {
  id: string;
  name: string;
  default: boolean;
}
export const idlePlayback: PlaybackState = {
  shuffled: false,
  repeat: "off",
  queue: [],
  status: "idle",
  reference: "",
  index: 0,
  total: 0,
  position_ms: 0,
  duration_ms: null,
  sample_rate: 0,
  volume: 0.5,
  history_confirmed: false,
  device: "",
  error: "",
  seek_id: 0,
  queue_id: 0,
  level: 0,
  levels: [0, 0, 0, 0],
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(t("État audio invalide."));
  return value as Record<string, unknown>;
}
const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
/** Reject malformed native responses rather than inventing a playback clock or output. */
export function parsePlayback(value: unknown): PlaybackState {
  const v = object(value);
  if (
    (v.source !== undefined && v.source !== "aede" && v.source !== "cd") ||
    !(["idle", "connecting", "playing", "paused", "ended", "error"] as unknown[]).includes(
      v.status,
    ) ||
    ![v.reference, v.device, v.error].every((s) => typeof s === "string") ||
    ![v.index, v.total, v.position_ms, v.sample_rate].every(count) ||
    Number(v.total) > 4096 ||
    (Number(v.total) > 0 && Number(v.index) >= Number(v.total)) ||
    (v.duration_ms !== null && !count(v.duration_ms)) ||
    typeof v.volume !== "number" ||
    !Number.isFinite(v.volume) ||
    v.volume < 0 ||
    v.volume > 1 ||
    typeof v.history_confirmed !== "boolean"
  )
    throw new Error(t("État audio invalide."));
  if (
    v.levels !== undefined &&
    (!Array.isArray(v.levels) ||
      v.levels.length !== 4 ||
      !v.levels.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1))
  )
    throw new Error(t("Niveaux audio invalides."));
  if (
    (v.spectrum !== undefined || v.spectrum_hz !== undefined) &&
    (!Array.isArray(v.spectrum) ||
      v.spectrum.length !== 24 ||
      !v.spectrum.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) ||
      !Array.isArray(v.spectrum_hz) ||
      v.spectrum_hz.length !== 24 ||
      !v.spectrum_hz.every(
        (n) => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 20000,
      ))
  )
    throw new Error(t("Niveaux audio invalides."));
  if (v.queue_id !== undefined && !count(v.queue_id))
    throw new Error(t("File de lecture invalide."));
  if (v.seek_id !== undefined && !count(v.seek_id))
    throw new Error(t("Confirmation de position invalide."));
  if (
    v.level !== undefined &&
    (typeof v.level !== "number" || !Number.isFinite(v.level) || v.level < 0 || v.level > 1)
  )
    throw new Error(t("Niveau audio invalide."));
  if (v.repeat !== undefined && !["off", "one", "all"].includes(String(v.repeat)))
    throw new Error(t("Répétition invalide."));
  if (v.shuffled !== undefined && typeof v.shuffled !== "boolean")
    throw new Error(t("File de lecture invalide."));
  if (
    v.queue !== undefined &&
    (!Array.isArray(v.queue) ||
      v.queue.length > 4096 ||
      v.queue.length > Number(v.total) ||
      new Set(v.queue).size !== v.queue.length ||
      !v.queue.every((index) => count(index) && index < Number(v.total)))
  )
    throw new Error(t("File de lecture invalide."));
  if (
    v.protected_occurrences !== undefined &&
    (!Array.isArray(v.protected_occurrences) ||
      v.protected_occurrences.length > 3 ||
      v.protected_occurrences.some((index) => !count(index) || index >= Number(v.total)))
  )
    throw new Error(t("File de lecture invalide."));
  return {
    ...(v.spectrum === undefined
      ? {}
      : { spectrum: v.spectrum as number[], spectrum_hz: v.spectrum_hz as number[] }),
    ...v,
    shuffled: v.shuffled ?? false,
    repeat: v.repeat ?? "off",
    queue: v.queue ?? [],
    seek_id: v.seek_id ?? 0,
    queue_id: v.queue_id ?? 0,
    level: v.level ?? 0,
    levels: v.levels ?? [0, 0, 0, 0],
  } as unknown as PlaybackState;
}
/** Outputs are explicitly discovered on the native host, never guessed from the catalog. */
export function parseOutputs(value: unknown): AudioOutput[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error(t("Sorties audio invalides."));
  const seen = new Set<string>();
  return value.map((item) => {
    const v = object(item);
    if (
      typeof v.id !== "string" ||
      !v.id ||
      v.id.length > 2048 ||
      seen.has(v.id) ||
      typeof v.name !== "string" ||
      typeof v.default !== "boolean"
    )
      throw new Error(t("Sorties audio invalides."));
    seen.add(v.id);
    return { id: v.id, name: v.name, default: v.default };
  });
}
