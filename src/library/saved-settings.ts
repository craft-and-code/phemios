import { parseAudioPreferences } from "./audio-preferences";
import { parseShortcuts } from "../navigation/shortcuts-policy";
import { readPreferences, applyPreferences } from "./preferences";
import { readMenuPreferences } from "../navigation/menu-preferences";
import { readToolPreferences } from "./tool-preferences";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { accountSettingKeys } from "./account-preference-keys";
export { accountSettingKeys } from "./account-preference-keys";
import {
  accountPreferenceOwner,
  activateInterfaceProfile,
  interfacePreferences,
  replaceInterfaceProfile,
  interfaceProfileOwner,
  interfaceProfileIdentity,
} from "./account-preferences";
/** Publish only explicitly supported non-secret settings after a successful local write. */
export function announceSetting(key: string, raw: string) {
  if (typeof window !== "undefined" && accountSettingKeys.some((value) => value === key))
    window.dispatchEvent(
      new CustomEvent("phemios-setting-save", {
        detail: { key, value: JSON.parse(raw), owner: interfaceProfileOwner() },
      }),
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
      if (key === "phemios.audio.v1") parseAudioPreferences(JSON.stringify(value));
      if (key === "phemios.shortcuts.v1") parseShortcuts(JSON.stringify(value));
      if (
        ["phemios.duration", "phemios.spectrum", "phemios.keep-awake"].includes(key) &&
        typeof value !== "boolean"
      )
        throw new Error(t("Préférences de compte invalides."));
      if (
        key === "phemios.visualizer" &&
        !["off", "sphere", "waves", "landscape", "floating"].includes(String(value))
      )
        throw new Error(t("Préférences de compte invalides."));
      if (key === "phemios.spectrum-style" && !["gradient", "terminal"].includes(String(value)))
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
    loading = false,
    edited = new Map<string, unknown>(),
    queue: Promise<void> = Promise.resolve();
  createEffect(() => {
    const identity = session(),
      origin = source(),
      epoch = ++generation;
    loaded = false;
    loading = !!identity;
    edited = new Map();
    setError("");
    setStatus("");
    const owner = accountPreferenceOwner(identity, origin);
    try {
      activateInterfaceProfile(owner, (values) => parseAccountSettings({ values }));
    } catch (failure) {
      setError(String(failure));
    }
    applyPreferences(readPreferences(interfacePreferences));
    window.dispatchEvent(new Event("phemios-settings-loaded"));
    window.dispatchEvent(new Event("phemios-preferences"));
    if (!identity) return;
    const projection = interfaceProfileIdentity();
    void (async () => {
      try {
        const info = await requestAede<{ capabilities?: string[] }>(
          "/api/v1/status",
          {},
          "GET",
          null,
          origin,
          identity,
        );
        if (!info.capabilities?.includes("account_preferences"))
          throw new Error(
            t("Mettez à jour puis redémarrez Aède pour synchroniser vos préférences."),
          );
        if (epoch !== generation || session() !== identity) return;
        const values = parseAccountSettings(
          await requestAede("/api/me/v1/preferences", {}, "GET", null, origin, identity),
        );
        if (epoch !== generation || session() !== identity) return;
        const next = { ...values, ...Object.fromEntries(edited) };
        if (!replaceInterfaceProfile(projection, next)) return;
        applyPreferences(readPreferences(interfacePreferences));
        loaded = true;
        loading = false;
        window.dispatchEvent(new Event("phemios-settings-loaded"));
        window.dispatchEvent(new Event("phemios-preferences"));
        setStatus("");
        for (const [key, value] of edited) enqueue(key, value, identity, origin, epoch);
        edited.clear();
      } catch (failure) {
        if (epoch === generation) {
          loading = false;
          setStatus("");
          setError(String(failure));
        }
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
    const { key, value, owner } = (
      event as CustomEvent<{ key: string; value: unknown; owner?: string }>
    ).detail;
    if (owner !== accountPreferenceOwner(identity, origin)) return;
    if (!accountSettingKeys.some((known) => known === key)) return;
    if (loading) {
      edited.set(key, value);
      setStatus(t("Enregistrement…"));
      return;
    }
    if (!loaded) {
      setError(
        t("Préférences enregistrées sur cet appareil ; synchronisation du compte indisponible."),
      );
      return;
    }
    enqueue(key, value, identity, origin, epoch);
  }
  function enqueue(
    key: string,
    value: unknown,
    identity: AccountSession,
    origin: SourceId,
    epoch: number,
  ) {
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
          identity,
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
    try {
      activateInterfaceProfile(undefined, (values) => parseAccountSettings({ values }));
    } catch {
      /* Preserve an unreadable device profile. */
    }
    applyPreferences(readPreferences(interfacePreferences));
    window.dispatchEvent(new Event("phemios-settings-loaded"));
    window.dispatchEvent(new Event("phemios-preferences"));
  });
  return { error, status };
}
