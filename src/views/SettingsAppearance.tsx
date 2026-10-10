import { announceSetting } from "../library/saved-settings";
import { readTheme, writeTheme } from "../library/themes";
import { importTheme, exportTheme, isNative } from "../platform/desktop";
import { t } from "../i18n";
import { createSignal, For, onMount, onCleanup, Show } from "solid-js";
import {
  applyPreferences,
  defaultPreferences,
  readPreferences,
  type Preferences,
} from "../library/preferences";
/** Colours apply live; portable theme documents contain no language or credentials. */
export function SettingsAppearance() {
  const [value, setValue] = createSignal<Preferences>({ ...defaultPreferences }),
    [error, setError] = createSignal("");
  const [name, setName] = createSignal("Phémios"),
    [busy, setBusy] = createSignal(false),
    [notice, setNotice] = createSignal("");
  onMount(() => {
    try {
      setValue(readPreferences(localStorage));
    } catch (e) {
      setError(String(e));
    }
  });
  onMount(() => {
    const reload = () => {
      try {
        setValue(readPreferences(localStorage));
      } catch (failure) {
        setError(String(failure));
      }
    };
    window.addEventListener("phemios-settings-loaded", reload);
    onCleanup(() => window.removeEventListener("phemios-settings-loaded", reload));
  });
  function update(next: Preferences) {
    try {
      readPreferences(localStorage);
      localStorage.setItem("phemios.appearance", JSON.stringify(next));
      announceSetting("phemios.appearance", JSON.stringify(next));
      setValue(next);
      applyPreferences(next);
      setError("");
      window.dispatchEvent(new Event("phemios-preferences"));
      return true;
    } catch {
      setError(t("Préférences non mémorisées."));
      return false;
    }
  }
  return (
    <div class="settings-card">
      <h2>{t("Couleurs et thèmes")}</h2>
      <div class="theme-preview">
        <span>{t("Aperçu")}</span>
        <strong>
          Phémios<span style={{ color: value().accent }}> ·</span>
        </strong>
        <small>{t("Votre bibliothèque, vos couleurs.")}</small>
      </div>
      <div class="color-settings">
        <For
          each={
            [
              "background",
              "accent",
              "surface",
              "text",
              "muted",
              "border",
              "sidebar",
              "player",
            ] as const
          }
        >
          {(key) => (
            <label>
              {
                {
                  background: t("Fond"),
                  accent: t("Contraste"),
                  surface: t("Surfaces"),
                  text: t("Texte"),
                  muted: t("Texte secondaire"),
                  border: t("Bordures"),
                  sidebar: t("Panneau de navigation"),
                  player: t("Barre de lecture"),
                }[key]
              }
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
        {t("Réinitialiser les couleurs")}{" "}
      </button>
      <hr />
      <label>
        {t("Nom du thème")}
        <input
          value={name()}
          maxlength="100"
          onInput={(event) => setName(event.currentTarget.value)}
        />
      </label>
      <div class="settings-actions">
        <button
          disabled={busy() || !isNative()}
          onClick={async () => {
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const path = await exportTheme(writeTheme(name(), value()));
              if (path) setNotice(t("Thème enregistré : {0}", path));
            } catch (failure) {
              setError(String(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("Enregistrer le thème")}
        </button>
        <button
          disabled={busy() || !isNative()}
          onClick={async () => {
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const raw = await importTheme();
              if (raw !== null) {
                if (update(readTheme(raw, value().language))) {
                  setName((JSON.parse(raw) as { name: string }).name);
                  setNotice(t("Thème importé."));
                }
              }
            } catch (failure) {
              setError(String(failure));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("Importer un thème")}
        </button>
      </div>
      <Show when={notice()}>
        <p class="notice" role="status">
          {notice()}
        </p>
      </Show>
      <p role="alert">{error()}</p>
    </div>
  );
}
