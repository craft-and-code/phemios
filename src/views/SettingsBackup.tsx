import { interfacePreferences, interfaceProfileIdentity } from "../library/account-preferences";
import { createApplicationBackupTransfer } from "../library/application-backup-transfer";
import { useLibrary } from "../library/context";
import { sourceLabel } from "../library/sources";
import { For, Show, onMount, onCleanup } from "solid-js";
import { t } from "../i18n";
import { ActionButton } from "../components/ActionButton";
import { Feedback } from "../components/Feedback";
import {
  importPreferences,
  exportPreferences,
  readPersonalBackup,
  restorePersonalBackup,
  isNative,
} from "../platform/desktop";
import { announceSetting } from "../library/saved-settings";
import { applyPreferences, readPreferences } from "../library/preferences";
/** A native chosen file is reviewed before an explicit all-settings restore. */
export function SettingsBackup() {
  const library = useLibrary();
  const transfer = createApplicationBackupTransfer({
    identity: interfaceProfileIdentity,
    storage: interfacePreferences,
    session: library.session,
    source: library.source,
    readPersonal: readPersonalBackup,
    restorePersonal: restorePersonalBackup,
    export: exportPreferences,
    import: importPreferences,
    personalRestored: () => library.podcastSubscriptions.reload(),
    preferencesApplied(values) {
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
          "Conservez vos menus, raccourcis, couleurs, langue et options de lecture, ainsi que les abonnements podcasts, épisodes écoutés et articles enregistrés du compte connecté. Cette sauvegarde contient des données personnelles. Les identifiants Aède et les clés API configurées sont exclus.",
        )}
      </p>
      <Show when={library.trackSources().length > 1}>
        <div class="choices" aria-label={t("Compte à sauvegarder")}>
          <For each={library.trackSources()}>
            {(row) => (
              <button
                disabled={busy()}
                aria-pressed={row.source === library.source()}
                onClick={() => library.chooseSource(row.source)}
              >
                {sourceLabel(row.source)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show
        when={library.session()}
        fallback={
          <p class="muted">
            {t("Sans compte connecté, seules les préférences d’interface seront sauvegardées.")}
          </p>
        }
      >
        {(account) => (
          <p class="muted">
            {t(
              "Compte sauvegardé : {0} · {1}",
              account().account.username,
              sourceLabel(library.source()),
            )}
          </p>
        )}
      </Show>
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
          <Show when={transfer.pending()?.personal}>
            {(personal) => (
              <>
                <p>
                  {t(
                    "Origine : {0} · {1}",
                    personal().origin.name,
                    personal().origin.source === "local" ? t("Local") : personal().origin.authority,
                  )}
                </p>
                <p>
                  {t(
                    "{0} abonnements podcasts · {1} épisodes écoutés · {2} articles enregistrés",
                    personal().podcasts.feeds.length,
                    personal().podcasts.episodes.length,
                    personal().articles.length,
                  )}
                </p>
                <p>
                  {t(
                    "Les éléments absents seront ajoutés au compte connecté. Les abonnements et articles déjà présents seront conservés.",
                  )}
                </p>
                <p>
                  {library.session()
                    ? t(
                        "Destination : {0} · {1}",
                        library.session()!.account.username,
                        library.source() === "local" ? t("Local") : library.session()!.server,
                      )
                    : t(
                        "Connectez-vous pour restaurer les podcasts et articles dans votre compte.",
                      )}
                </p>
              </>
            )}
          </Show>
          <div class="settings-actions">
            <ActionButton
              icon="check"
              busy={transfer.action() === "restore"}
              disabled={
                busy() ||
                (!!transfer.pending()?.personal &&
                  !["user", "admin"].includes(library.session()?.account.role ?? ""))
              }
              onClick={() => void transfer.apply()}
            >
              {t("Appliquer les préférences")}
            </ActionButton>
            <ActionButton icon="close" disabled={busy()} onClick={transfer.clearPending}>
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
