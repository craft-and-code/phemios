import { t } from "../i18n";
export const audioPreferenceKey = "phemios.audio.v1";
export interface AudioPreferences {
  volume: number;
  crossfadeMs: number;
  repeat: "off" | "one" | "all";
  policy: "dsp" | "without-effects";
}
export const defaultAudioPreferences: AudioPreferences = {
  volume: 0.5,
  crossfadeMs: 0,
  repeat: "off",
  policy: "without-effects",
};
/** Only bounded non-secret transport policies synchronize with the account. */
export function parseAudioPreferences(raw: string | null): AudioPreferences {
  if (raw === null) return { ...defaultAudioPreferences };
  const value = JSON.parse(raw) as AudioPreferences;
  if (
    !value ||
    typeof value !== "object" ||
    !Number.isInteger(value.crossfadeMs) ||
    value.crossfadeMs < 0 ||
    value.crossfadeMs > 10000 ||
    !["off", "one", "all"].includes(value.repeat) ||
    !["dsp", "without-effects"].includes(value.policy) ||
    (value.volume !== undefined &&
      (typeof value.volume !== "number" ||
        !Number.isFinite(value.volume) ||
        value.volume < 0 ||
        value.volume > 1))
  )
    throw Error(t("Préférences de lecture invalides."));
  return {
    crossfadeMs: value.crossfadeMs,
    repeat: value.repeat,
    policy: value.policy,
    volume: value.volume ?? 0.5,
  };
}
