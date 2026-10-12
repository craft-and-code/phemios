import { interfacePreferences, interfaceProfileIdentity } from "../library/account-preferences";
import { createPreferenceTransfer } from "../library/preference-transfer";
import { Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import { ActionButton } from "../components/ActionButton";
import { Feedback } from "../components/Feedback";
import { importPreferences, exportPreferences, isNative } from "../platform/desktop";
import {
  exportPreferenceBackup,
  parsePreferenceBackup,
  applyPreferenceBackup,
} from "../library/preference-backup";
import { announceSetting } from "../library/saved-settings";
import { applyPreferences, readPreferences } from "../library/preferences";
/** A native chosen file is reviewed before an explicit all-settings restore. */
export function SettingsBackup() {
  const transfer = createPreferenceTransfer({
    identity: interfaceProfileIdentity,
    read: () => exportPreferenceBackup(interfacePreferences),
    export: exportPreferences,
    import: importPreferences,
    parse: parsePreferenceBackup,
    apply(input) {
      const values = applyPreferenceBackup(interfacePreferences, input);
      applyPreferences(readPreferences(interfacePreferences));
      window.dispatchEvent(new Event("phemios-settings-loaded"));
      window.dispatchEvent(new Event("phemios-preferences"));
      for (const [key, value] of Object.entries(values))
        announceSetting(key, JSON.stringify(value));
    },
  });
  const busy = () => transfer.action() !== undefined;
  onMount(() => window.addEventListener("phemios-settings-loaded", transfer.changed));
  onCleanup(() => {
    transfer.dispose();
    window.removeEventListener("phemios-settings-loaded", transfer.changed);
  });
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
          busy={transfer.action() === "export"}
          disabled={!isNative() || busy()}
          onClick={() => void transfer.run(true)}
        >
          {t("Exporter les préférences")}
        </ActionButton>
        <ActionButton
          icon="upload"
          busy={transfer.action() === "import"}
          disabled={!isNative() || busy()}
          onClick={() => void transfer.run(false)}
        >
          {t("Importer les préférences")}
        </ActionButton>
      </div>
      <Show when={transfer.pending()}>
        <div class="preference-import-review">
          <p>
            {t(
              "Cette sauvegarde remplacera vos réglages d’interface actuels : menus et noms, raccourcis, couleurs, langue et lecture.",
            )}
          </p>
          <div class="settings-actions">
            <ActionButton icon="check" onClick={transfer.apply}>
              {t("Appliquer les préférences")}
            </ActionButton>
            <ActionButton icon="close" onClick={transfer.clearPending}>
              {t("Annuler")}
            </ActionButton>
          </div>
        </div>
      </Show>
      <Feedback error message={transfer.error()} onClose={transfer.clearError} />
      <Feedback message={transfer.message()} onClose={transfer.clearMessage} />
    </section>
  );
}
