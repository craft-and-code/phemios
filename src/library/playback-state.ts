/** Public native playback state. Its clock counts source frames consumed by the callback. */
export interface PlaybackState {
  status: "idle" | "connecting" | "playing" | "paused" | "ended" | "error";
  reference: string;
  index: number;
  total: number;
  position_ms: number;
  duration_ms: number | null;
  sample_rate: number;
  volume: number;
  history_confirmed: boolean;
  device: string;
  error: string;
  seek_id: number;
  level: number;
  levels: readonly number[];
}
export interface AudioOutput {
  id: string;
  name: string;
  default: boolean;
}
export const idlePlayback: PlaybackState = {
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
  level: 0,
  levels: [0, 0, 0, 0],
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("État audio invalide.");
  return value as Record<string, unknown>;
}
const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
/** Reject malformed native responses rather than inventing a playback clock or output. */
export function parsePlayback(value: unknown): PlaybackState {
  const v = object(value);
  if (
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
    throw new Error("État audio invalide.");
  if (
    v.levels !== undefined &&
    (!Array.isArray(v.levels) ||
      v.levels.length !== 4 ||
      !v.levels.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1))
  )
    throw new Error("Niveaux audio invalides.");
  if (v.seek_id !== undefined && !count(v.seek_id))
    throw new Error("Confirmation de position invalide.");
  if (
    v.level !== undefined &&
    (typeof v.level !== "number" || !Number.isFinite(v.level) || v.level < 0 || v.level > 1)
  )
    throw new Error("Niveau audio invalide.");
  return {
    ...v,
    seek_id: v.seek_id ?? 0,
    level: v.level ?? 0,
    levels: v.levels ?? [0, 0, 0, 0],
  } as unknown as PlaybackState;
}
/** Outputs are explicitly discovered on the native host, never guessed from the catalog. */
export function parseOutputs(value: unknown): AudioOutput[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error("Sorties audio invalides.");
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
      throw new Error("Sorties audio invalides.");
    seen.add(v.id);
    return { id: v.id, name: v.name, default: v.default };
  });
}
