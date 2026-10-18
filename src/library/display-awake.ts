import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { t } from "../i18n";
import { interfacePreferences } from "./account-preferences";
import { announceSetting } from "./saved-settings";
import { openAwakeScope, updateAwakeScope } from "../platform/desktop";
/** Only confirmed playing states inhibit idle; connection attempts and pauses never do. */
export const anyAudioPlaying = (...statuses: readonly string[]) =>
  statuses.some((status) => status === "playing");
/** Global playback-owned lease, separate from view navigation and serialized through final release. */
export function createDisplayAwake(
  input: { native: boolean; playing: () => boolean },
  backend = { open: openAwakeScope, update: updateAwakeScope },
) {
  const [enabled, setEnabled] = createSignal(true),
    [active, setActive] = createSignal(false),
    [preferenceError, setPreferenceError] = createSignal(""),
    [nativeError, setNativeError] = createSignal("");
  let disposed = false,
    running = false,
    dirty = false,
    scope: string | undefined,
    last: boolean | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  const wanted = createMemo(() => input.native && enabled() && input.playing());
  const desired = () => !disposed && wanted();
  function restore() {
    try {
      const raw = interfacePreferences.getItem("phemios.keep-awake"),
        value = raw === null ? true : JSON.parse(raw);
      if (typeof value !== "boolean") throw Error(t("Préférences de lecture invalides."));
      setEnabled(value);
      setPreferenceError("");
    } catch (error) {
      setEnabled(false);
      setPreferenceError(String(error));
    }
  }
  restore();
  window.addEventListener("phemios-settings-loaded", restore);
  async function update(force = false) {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        if (!scope && !untrack(desired)) break;
        if (!scope) scope = await backend.open();
        const wanted = untrack(desired);
        if (force || last !== wanted) {
          // A lost reply can hide a successful native change. Do not reuse an older acknowledgement.
          last = undefined;
          await backend.update(scope, wanted);
          last = wanted;
          if (!disposed) {
            setActive(wanted);
            setNativeError("");
          }
        }
        force = false;
        if (wanted !== untrack(desired)) dirty = true;
      } while (dirty);
    } catch (error) {
      if (!disposed) setNativeError(String(error));
    } finally {
      running = false;
      if (disposed && scope) void backend.update(scope, false).catch(() => {});
      else if (dirty) void update();
      else if (untrack(desired)) timer = setTimeout(() => void update(true), 5000);
    }
  }
  createEffect(() => {
    desired();
    void update();
  });
  onCleanup(() => {
    disposed = true;
    window.removeEventListener("phemios-settings-loaded", restore);
    if (timer !== undefined) clearTimeout(timer);
    void update();
  });
  return {
    enabled,
    active,
    error: () => preferenceError() || nativeError(),
    setEnabled(value: boolean) {
      try {
        interfacePreferences.setItem("phemios.keep-awake", JSON.stringify(value));
        setEnabled(value);
        setPreferenceError("");
        announceSetting("phemios.keep-awake", JSON.stringify(value));
      } catch (error) {
        setPreferenceError(String(error));
      }
    },
  };
}
