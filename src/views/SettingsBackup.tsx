import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { ActionButton } from "../components/ActionButton";
import { Feedback } from "../components/Feedback";
import { importPreferences, exportPreferences, isNative } from "../platform/desktop";
import {
  exportPreferenceBackup,
  parsePreferenceBackup,
  applyPreferenceBackup,
  type PreferenceBackup,
} from "../library/preference-backup";
import { announceSetting } from "../library/saved-settings";
import { applyPreferences, readPreferences } from "../library/preferences";
/** A native chosen file is reviewed before an explicit all-settings restore. */
export function SettingsBackup() {
  const [busy, setBusy] = createSignal(false),
    [pending, setPending] = createSignal<PreferenceBackup>(),
    [error, setError] = createSignal(""),
    [message, setMessage] = createSignal("");
  async function run(exporting: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    setPending(undefined);
    try {
      if (exporting) {
        const path = await exportPreferences(exportPreferenceBackup(localStorage));
        if (path) setMessage(t("Préférences enregistrées : {0}", path));
      } else {
        const raw = await importPreferences();
        if (raw !== null) setPending(parsePreferenceBackup(raw));
      }
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  function restore() {
    const input = pending();
    if (!input) return;
    try {
      const values = applyPreferenceBackup(localStorage, input);
      applyPreferences(readPreferences(localStorage));
      window.dispatchEvent(new Event("phemios-settings-loaded"));
      window.dispatchEvent(new Event("phemios-preferences"));
      for (const [key, value] of Object.entries(values))
        announceSetting(key, JSON.stringify(value));
      setPending(undefined);
      setMessage(t("Préférences importées."));
      setError("");
    } catch (failure) {
      setError(String(failure));
    }
  }
  return (
    <section class="settings-card">
      <h2>{t("Sauvegarde des préférences")}</h2>
      <p>
        {t(
          "Conservez vos menus, raccourcis, couleurs, langue et options de lecture dans un fichier, puis retrouvez-les sur une autre installation de Phémios.",
        )}
      </p>
      <div class="settings-actions">
        <ActionButton
          icon="download"
          busy={busy()}
          disabled={!isNative() || busy()}
          onClick={() => void run(true)}
        >
          {t("Exporter les préférences")}
        </ActionButton>
        <ActionButton
          icon="upload"
          disabled={!isNative() || busy()}
          onClick={() => void run(false)}
        >
          {t("Importer les préférences")}
        </ActionButton>
      </div>
      <Show when={pending()}>
        <div class="preference-import-review">
          <p>
            {t(
              "Cette sauvegarde remplacera vos réglages d’interface actuels : menus et noms, raccourcis, couleurs, langue et lecture.",
            )}
          </p>
          <div class="settings-actions">
            <ActionButton icon="check" onClick={restore}>
              {t("Appliquer les préférences")}
            </ActionButton>
            <ActionButton icon="close" onClick={() => setPending(undefined)}>
              {t("Annuler")}
            </ActionButton>
          </div>
        </div>
      </Show>
      <Feedback error message={error()} onClose={() => setError("")} />
      <Feedback message={message()} onClose={() => setMessage("")} />
    </section>
  );
}
