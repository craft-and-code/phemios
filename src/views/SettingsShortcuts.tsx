import { For } from "solid-js";
import { t } from "../i18n";
import { createShortcuts, keyBinding, type ShortcutAction } from "../navigation/shortcuts";
import { Feedback } from "../components/Feedback";
import { Icon } from "../components/Icon";
export function SettingsShortcuts() {
  const settings = createShortcuts();
  const labels: Record<ShortcutAction, string> = {
    toggle: "Lecture / pause",
    stop: "Arrêter la lecture",
    previous: "Morceau précédent",
    next: "Morceau suivant",
    mute: "Couper / rétablir le son",
    search: "Rechercher",
    advanced: "Recherche avancée",
    playback: "Vue Lecture",
    settings: "Paramètres",
    queue: "Afficher ou masquer la liste de lecture",
  };
  const display = (binding: string) =>
    binding
      .replace("Mod", /Mac/.test(navigator.platform) ? "⌘" : "Ctrl")
      .replace(/Key([A-Z])/, "$1")
      .replace("Space", t("Espace"))
      .replace("ArrowLeft", "←")
      .replace("ArrowRight", "→")
      .replace("Comma", ",")
      .replaceAll("+", " + ");
  return (
    <section class="settings-card">
      <div class="section-heading">
        <h2>{t("Raccourcis clavier")}</h2>
        <button onClick={settings.reset}>{t("Réinitialiser")}</button>
      </div>
      <p class="muted">
        {t(
          "Cliquez sur un raccourci puis pressez les touches souhaitées. Command sur Mac, Control sur Windows/Linux. Les raccourcis sont suspendus pendant la saisie.",
        )}
      </p>
      <div class="shortcut-rows">
        <For each={Object.keys(labels) as ShortcutAction[]}>
          {(action) => (
            <label>
              <span>{t(labels[action])}</span>
              <input
                readonly
                aria-label={t(labels[action])}
                value={display(settings.value()[action])}
                placeholder={t("Désactivé")}
                onKeyDown={(event) => {
                  if (event.code === "Tab") return;
                  event.preventDefault();
                  const binding = keyBinding(event);
                  if (binding) settings.update(action, binding);
                }}
              />
              <button
                type="button"
                class="icon-button quiet icon-close"
                title={t("Désactiver le raccourci")}
                aria-label={t("Désactiver le raccourci")}
                onClick={() => settings.update(action, "")}
              >
                <Icon name="close" />
              </button>
            </label>
          )}
        </For>
      </div>
      <Feedback error message={settings.error()} />
    </section>
  );
}
