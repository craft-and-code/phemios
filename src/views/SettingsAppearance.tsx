import { interfacePreferences, interfaceProfileIdentity } from "../library/account-preferences";
import { Feedback } from "../components/Feedback";
import { Icon } from "../components/Icon";
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
  let alive = true,
    identity = interfaceProfileIdentity();
  onCleanup(() => {
    alive = false;
  });
  onMount(() => {
    try {
      setValue(readPreferences(interfacePreferences));
    } catch (e) {
      setError(String(e));
    }
  });
  onMount(() => {
    const reload = () => {
      const next = interfaceProfileIdentity();
      if (next !== identity) {
        identity = next;
        setName("Phémios");
        setNotice("");
        setError("");
      }
      try {
        setValue(readPreferences(interfacePreferences));
      } catch (failure) {
        setError(String(failure));
      }
    };
    window.addEventListener("phemios-settings-loaded", reload);
    onCleanup(() => window.removeEventListener("phemios-settings-loaded", reload));
  });
  function update(next: Preferences) {
    try {
      readPreferences(interfacePreferences);
      interfacePreferences.setItem("phemios.appearance", JSON.stringify(next));
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
        <div class="theme-preview-shell">
          <aside>
            <img src="/favicon.svg" alt="Phémios" width="44" height="44" />
            <span class="wordmark">
              phémios<span class="brand-dot">.</span>
            </span>
            <span class="theme-preview-menu">
              <Icon name="disc" />
              {t("Albums")}
            </span>
          </aside>
          <div class="theme-preview-content">
            <small>{t("Votre bibliothèque, vos couleurs.")}</small>
            <input
              readonly
              aria-label={t("Aperçu du champ de recherche")}
              value={t("Rechercher dans la bibliothèque")}
            />
            <div class="settings-actions">
              <button class="primary" type="button">
                <Icon name="play" />
                {t("Lecture")}
              </button>
              <button
                class="icon-button"
                type="button"
                aria-pressed="true"
                aria-label={t("Favoris")}
              >
                <Icon name="heart" />
              </button>
              <span class="tag-pill">music</span>
            </div>
            <div class="theme-preview-player">
              <Icon name="volume" />
              <span>{t("Barre de lecture")}</span>
            </div>
          </div>
        </div>
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
            const held = interfaceProfileIdentity(),
              current = () => alive && interfaceProfileIdentity() === held;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const path = await exportTheme(writeTheme(name(), value()));
              if (path && current()) setNotice(t("Thème enregistré : {0}", path));
            } catch (failure) {
              if (current()) setError(String(failure));
            } finally {
              if (alive) setBusy(false);
            }
          }}
        >
          {t("Enregistrer le thème")}
        </button>
        <button
          disabled={busy() || !isNative()}
          onClick={async () => {
            const held = interfaceProfileIdentity(),
              current = () => alive && interfaceProfileIdentity() === held;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const raw = await importTheme();
              if (raw !== null && current()) {
                if (update(readTheme(raw, value().language))) {
                  setName((JSON.parse(raw) as { name: string }).name);
                  setNotice(t("Thème importé."));
                }
              }
            } catch (failure) {
              if (current()) setError(String(failure));
            } finally {
              if (alive) setBusy(false);
            }
          }}
        >
          {t("Importer un thème")}
        </button>
      </div>
      <Show when={notice()}>
        <Feedback message={notice()} onClose={() => setNotice("")} />
      </Show>
      <Feedback error message={error()} onClose={() => setError("")} />
    </div>
  );
}
