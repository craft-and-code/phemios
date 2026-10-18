import { t } from "../i18n";
import { writePreferenceEntries } from "./preference-storage";
import { accountSettingKeys, parseAccountSettings } from "./saved-settings";
import { readMenuPreferences } from "../navigation/menu-preferences";
import { parseShortcuts } from "../navigation/shortcuts-policy";
import { parseAudioPreferences } from "./audio-preferences";
import { readPreferences } from "./preferences";
import { readToolPreferences } from "./tool-preferences";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type PreferenceBackup = Record<string, unknown>;
const empty = { getItem: () => null, setItem: () => {} };
/** Complete interface snapshot; native folders, secrets, accounts and personal library data are excluded. */
export function exportPreferenceBackup(storage: Pick<Storage, "getItem">): string {
  const defaults: PreferenceBackup = {
    "phemios.appearance": readPreferences(empty),
    "phemios.navigation.v1": { version: 6, ...readMenuPreferences(empty) },
    "phemios.tools.v1": readToolPreferences(empty),
    "phemios.shortcuts.v1": parseShortcuts(null),
    "phemios.audio.v1": parseAudioPreferences(null),
    "phemios.duration": false,
    "phemios.visualizer": "sphere",
    "phemios.spectrum": false,
    "phemios.spectrum-style": "gradient",
  };
  const values = Object.fromEntries(
    accountSettingKeys.map((key) => {
      const raw = storage.getItem(key);
      return [key, raw === null ? defaults[key] : JSON.parse(raw)];
    }),
  );
  const raw = JSON.stringify({ format: "phemios-preferences", version: 1, values }, null, 2);
  parsePreferenceBackup(raw);
  return raw;
}
/** Validate the entire explicit import before any browser preference can be changed. */
export function parsePreferenceBackup(raw: string): PreferenceBackup {
  if (raw.length > 131072) throw new Error(t("Sauvegarde des préférences invalide."));
  const document = JSON.parse(raw) as { format?: unknown; version?: unknown; values?: unknown };
  if (
    !document ||
    document.format !== "phemios-preferences" ||
    document.version !== 1 ||
    Object.keys(document).some((key) => !["format", "version", "values"].includes(key))
  )
    throw new Error(t("Sauvegarde des préférences invalide."));
  const values = document.values;
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    Object.keys(values).length !== accountSettingKeys.length ||
    Object.keys(values).some((key) => !accountSettingKeys.some((known) => known === key))
  )
    throw new Error(t("Sauvegarde des préférences invalide."));
  const parsed = parseAccountSettings({ values });
  for (const [key, allowed] of [
    ["phemios.navigation.v1", ["version", "order", "hidden", "labels"]],
    ["phemios.audio.v1", ["crossfadeMs", "repeat", "policy", "volume"]],
  ] as const)
    if (Object.keys(parsed[key] as object).some((field) => !allowed.some((name) => name === field)))
      throw new Error(t("Sauvegarde des préférences invalide."));
  return parsed;
}
/** Roll back already-written keys on a storage failure; never acknowledge a partial restoration. */
export function applyPreferenceBackup(storage: Store, values: PreferenceBackup) {
  const checked = parsePreferenceBackup(
    JSON.stringify({ format: "phemios-preferences", version: 1, values }),
  );
  writePreferenceEntries(storage, checked);
  return checked;
}
