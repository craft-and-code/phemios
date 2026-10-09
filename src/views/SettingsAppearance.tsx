import { createSignal, For, onMount } from "solid-js";
import {
  applyPreferences,
  defaultPreferences,
  readPreferences,
  type Preferences,
} from "../library/preferences";
/** Appearance is device-local. Translation is a separate integration milestone. */
export function SettingsAppearance() {
  const [value, setValue] = createSignal<Preferences>({ ...defaultPreferences }),
    [error, setError] = createSignal("");
  onMount(() => {
    try {
      setValue(readPreferences(localStorage));
    } catch (e) {
      setError(String(e));
    }
  });
  function update(next: Preferences) {
    setValue(next);
    applyPreferences(next);
    try {
      localStorage.setItem("phemios.appearance", JSON.stringify(next));
      setError("");
      window.dispatchEvent(new Event("phemios-preferences"));
    } catch {
      setError("Préférences non mémorisées.");
    }
  }
  return (
    <div class="settings-card">
      <h2>Apparence et langue</h2>
      <label>
        Langue
        <select
          value={value().language}
          onChange={(e) => update({ ...value(), language: e.currentTarget.value as "fr" | "en" })}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </label>
      <div class="color-settings">
        <For each={["background", "accent", "surface"] as const}>
          {(key) => (
            <label>
              {{ background: "Fond", accent: "Contraste", surface: "Surfaces" }[key]}
              <input
                type="color"
                value={value()[key]}
                onInput={(e) => update({ ...value(), [key]: e.currentTarget.value })}
              />
            </label>
          )}
        </For>
      </div>
      <button onClick={() => update({ ...defaultPreferences, language: value().language })}>
        Réinitialiser les couleurs
      </button>
      <p role="alert">{error()}</p>
    </div>
  );
}
