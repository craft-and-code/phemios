import { interfacePreferences } from "../library/account-preferences";
import { createSignal, onCleanup, onMount } from "solid-js";
import { announceSetting } from "../library/saved-settings";
import {
  shortcutKey,
  defaultShortcuts,
  parseShortcuts,
  type Shortcuts,
  type ShortcutAction,
} from "./shortcuts-policy";
export {
  shortcutKey,
  defaultShortcuts,
  parseShortcuts,
  keyBinding,
  shortcutAction,
  type Shortcuts,
  type ShortcutAction,
} from "./shortcuts-policy";
/** Local persistence is acknowledged before the existing owner-private preference synchronizer runs. */
export function createShortcuts() {
  const [value, setValue] = createSignal<Shortcuts>({ ...defaultShortcuts }),
    [error, setError] = createSignal("");
  function restore() {
    try {
      setValue(parseShortcuts(interfacePreferences.getItem(shortcutKey)));
      setError("");
    } catch (failure) {
      setError(String(failure));
    }
  }
  restore();
  onMount(() => {
    window.addEventListener("phemios-settings-loaded", restore);
    window.addEventListener("phemios-shortcuts", restore);
  });
  onCleanup(() => {
    window.removeEventListener("phemios-settings-loaded", restore);
    window.removeEventListener("phemios-shortcuts", restore);
  });
  function save(next: Shortcuts) {
    try {
      const raw = JSON.stringify(next);
      parseShortcuts(raw);
      interfacePreferences.setItem(shortcutKey, raw);
      setValue(next);
      setError("");
      announceSetting(shortcutKey, raw);
      window.dispatchEvent(new Event("phemios-shortcuts"));
    } catch (failure) {
      setError(String(failure));
    }
  }
  return {
    value,
    error,
    update: (action: ShortcutAction, binding: string) => save({ ...value(), [action]: binding }),
    reset: () => save({ ...defaultShortcuts }),
  };
}
