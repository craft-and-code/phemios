import { changeLanguage } from "../i18n";
import { t } from "../i18n";
export interface Preferences {
  language: "fr" | "en";
  background: string;
  accent: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  sidebar: string;
  player: string;
}
export const defaultPreferences: Preferences = {
  language: "fr",
  background: "#111213",
  accent: "#d8f36a",
  surface: "#1a1c1d",
  text: "#f1f0eb",
  muted: "#a4a6a7",
  border: "#303234",
  sidebar: "#151718",
  player: "#1a1c1d",
};
/** Corrupt preferences are reported; secrets never belong in browser settings. */
export function readPreferences(storage: Pick<Storage, "getItem">): Preferences {
  const raw = storage.getItem("phemios.appearance");
  if (!raw) return { ...defaultPreferences };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error(t("Préférences illisibles."));
  const v = value as Record<string, unknown>;
  if (
    !["fr", "en"].includes(String(v.language)) ||
    ![v.background, v.accent, v.surface].every(
      (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
    )
  )
    throw new Error(t("Préférences invalides."));
  const next: Record<string, unknown> = { ...defaultPreferences, ...v };
  if (v.text === undefined)
    next.text = luminance(String(v.background)) > 0.55 ? "#17191a" : "#f1f0eb";
  for (const key of Object.keys(defaultPreferences)) {
    if (
      key !== "language" &&
      (typeof next[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(next[key] as string))
    )
      throw new Error(t("Préférences invalides."));
  }
  if (Object.keys(v).some((key) => !Object.hasOwn(defaultPreferences, key)))
    throw new Error(t("Préférences invalides."));
  return next as unknown as Preferences;
}
export function applyPreferences(value: Preferences) {
  const root = document.documentElement;
  changeLanguage(value.language);
  for (const [key, color] of Object.entries(value))
    if (key !== "language") root.style.setProperty(`--${key}`, color);

  root.style.setProperty("--accent-text", luminance(value.accent) > 0.5 ? "#17191a" : "#ffffff");
}

function luminance(color: string): number {
  return [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i]!, 0);
}
