import { readPreferences, defaultPreferences, type Preferences } from "./preferences";
import { t } from "../i18n";
export const colorKeys = Object.keys(defaultPreferences).filter(
  (key) => key !== "language",
) as Exclude<keyof Preferences, "language">[];
/** Portable colour-only themes never import account, language or service credentials. */
export function readTheme(raw: string, language: Preferences["language"]): Preferences {
  if (raw.length > 4096) throw new Error(t("Thème invalide."));
  const value = JSON.parse(raw) as {
    format?: unknown;
    version?: unknown;
    name?: unknown;
    colors?: Record<string, unknown>;
  };
  if (
    value?.format !== "phemios-theme" ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    value.name.length > 100 ||
    !value.colors ||
    Object.keys(value.colors).length !== colorKeys.length ||
    colorKeys.some((key) => !Object.hasOwn(value.colors!, key))
  )
    throw new Error(t("Thème invalide."));
  return readPreferences({ getItem: () => JSON.stringify({ ...value.colors, language }) });
}
export function writeTheme(name: string, value: Preferences): string {
  if (!name.trim() || name.trim().length > 100) throw new Error(t("Donnez un nom au thème."));
  return JSON.stringify(
    {
      format: "phemios-theme",
      version: 1,
      name: name.trim(),
      colors: Object.fromEntries(colorKeys.map((key) => [key, value[key]])),
    },
    null,
    2,
  );
}
