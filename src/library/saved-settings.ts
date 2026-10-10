import { readPreferences, applyPreferences } from "./preferences";
import { readMenuPreferences } from "../navigation/menu-preferences";
import { readToolPreferences } from "./tool-preferences";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
export const accountSettingKeys = [
  "phemios.appearance",
  "phemios.navigation.v1",
  "phemios.tools.v1",
  "phemios.duration",
  "phemios.visualizer",
] as const;
/** Publish only explicitly supported non-secret settings after a successful local write. */
export function announceSetting(key: string, raw: string) {
  if (typeof window !== "undefined" && accountSettingKeys.some((value) => value === key))
    window.dispatchEvent(
      new CustomEvent("phemios-setting-save", { detail: { key, value: JSON.parse(raw) } }),
    );
}
/** Parse the account projection without admitting native roots, credentials or arbitrary storage keys. */
export function parseAccountSettings(raw: unknown): Record<string, unknown> {
  const values = (raw as { values?: unknown })?.values;
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw new Error(t("Préférences de compte invalides."));
  const result: Record<string, unknown> = {};
  for (const key of accountSettingKeys)
    if (Object.hasOwn(values, key)) {
      const value = (values as Record<string, unknown>)[key];
      if (JSON.stringify(value).length > 8192)
        throw new Error(t("Préférences de compte invalides."));
      const storage = { getItem: () => JSON.stringify(value), setItem: () => {} };
      if (key === "phemios.appearance") readPreferences(storage);
      if (key === "phemios.navigation.v1") readMenuPreferences(storage);
      if (key === "phemios.tools.v1") readToolPreferences(storage);
      if (key === "phemios.duration" && typeof value !== "boolean")
        throw new Error(t("Préférences de compte invalides."));
      if (key === "phemios.visualizer" && !["sphere", "waves", "landscape"].includes(String(value)))
        throw new Error(t("Préférences de compte invalides."));
      result[key] = value;
    }
  return result;
}
/** Load once per authenticated identity; serialized patches never cross a replaced account/source. */
export function createSavedSettings(
  session: () => AccountSession | undefined,
  source: () => SourceId,
) {
  const [error, setError] = createSignal(""),
    [status, setStatus] = createSignal("");
  let generation = 0,
    loaded = false,
    queue: Promise<void> = Promise.resolve();
  createEffect(() => {
    const identity = session(),
      origin = source(),
      epoch = ++generation;
    loaded = false;
    setError("");
    setStatus("");
    if (!identity) return;
    void (async () => {
      try {
        const info = await requestAede<{ capabilities?: string[] }>(
          "/api/v1/status",
          {},
          "GET",
          null,
          origin,
        );
        if (!info.capabilities?.includes("account_preferences"))
          throw new Error(
            t("Mettez à jour puis redémarrez Aède pour synchroniser vos préférences."),
          );
        const values = parseAccountSettings(
          await requestAede("/api/me/v1/preferences", {}, "GET", null, origin),
        );
        if (epoch !== generation || session() !== identity) return;
        // Preserve malformed device stores rather than replacing them on login.
        readPreferences(localStorage);
        readMenuPreferences(localStorage);
        readToolPreferences(localStorage);
        localStorage.setItem(
          "phemios.duration",
          JSON.stringify(values["phemios.duration"] ?? false),
        );
        for (const [key, value] of Object.entries(values))
          localStorage.setItem(key, JSON.stringify(value));
        applyPreferences(readPreferences(localStorage));
        loaded = true;
        window.dispatchEvent(new Event("phemios-settings-loaded"));
        window.dispatchEvent(new Event("phemios-preferences"));
        setStatus(t("Préférences synchronisées avec votre compte."));
      } catch (failure) {
        if (epoch === generation) setError(String(failure));
      }
    })();
  });
  function save(event: Event) {
    const identity = session(),
      origin = source(),
      epoch = generation;
    if (!identity) {
      setStatus(t("Préférences enregistrées sur cet appareil."));
      return;
    }
    if (!loaded) {
      setError(
        t("Préférences enregistrées sur cet appareil ; synchronisation du compte indisponible."),
      );
      return;
    }
    const { key, value } = (event as CustomEvent<{ key: string; value: unknown }>).detail;
    queue = queue.then(async () => {
      if (epoch !== generation || identity !== session()) return;
      setStatus(t("Enregistrement…"));
      try {
        await requestAede(
          "/api/me/v1/preferences",
          {},
          "PATCH",
          { values: { [key]: value } },
          origin,
        );
        if (epoch === generation) {
          setStatus(t("Enregistré dans votre compte Aède."));
          setError("");
        }
      } catch (failure) {
        if (epoch === generation) {
          setStatus("");
          setError(String(failure));
        }
      }
    });
  }
  window.addEventListener("phemios-setting-save", save);
  onCleanup(() => {
    generation++;
    window.removeEventListener("phemios-setting-save", save);
  });
  return { error, status };
}
