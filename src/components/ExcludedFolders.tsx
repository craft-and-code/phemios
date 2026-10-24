import { For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { createExcludedFolders } from "../library/excluded-folders";
import { localRootAction, pickLocalExclusions, requestAede } from "../platform/desktop";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** A read-only path list permits selection/removal without typing or modifying folder names. */
export function ExcludedFolders(props: { disabled: boolean }) {
  const library = useLibrary();
  const folders = createExcludedFolders({
    session: library.localSession,
    page: (offset, owner) =>
      requestAede(
        "/api/v1/roots",
        { offset: String(offset), limit: "200" },
        "GET",
        null,
        "local",
        owner,
      ),
    pick: pickLocalExclusions,
    change: localRootAction,
  });
  const disabled = () =>
    props.disabled ||
    library.busy() ||
    folders.busy() ||
    folders.read.pending() ||
    library.localSession()?.account.role !== "admin";
  return (
    <section class="excluded-folders">
      <div class="section-heading">
        <h3>{t("Dossiers exclus du scan")}</h3>
        <div class="settings-actions">
          <button
            class="icon-button quiet"
            title={t("Ajouter des dossiers exclus")}
            aria-label={t("Ajouter des dossiers exclus")}
            disabled={disabled()}
            onClick={() => void folders.add()}
          >
            <Icon name="plus" />
          </button>
          <button
            class="icon-button quiet"
            title={t("Retirer l’exclusion sélectionnée")}
            aria-label={t("Retirer l’exclusion sélectionnée")}
            disabled={disabled() || !folders.selection()}
            onClick={() => void folders.remove()}
          >
            <Icon name="minus" />
          </button>
        </div>
      </div>
      <ul
        class="excluded-folder-list"
        aria-label={t("Dossiers exclus du scan")}
        aria-busy={folders.read.loading() || folders.busy()}
      >
        <Show when={folders.read.loading()}>
          <li class="muted">
            <span class="spinner" aria-hidden="true" /> {t("Lecture des exclusions…")}
          </li>
        </Show>
        <For each={folders.read.current()}>
          {(path) => (
            <li>
              <button
                class="excluded-folder-path"
                classList={{ selected: folders.selection() === path }}
                aria-pressed={folders.selection() === path}
                onClick={() => folders.select(path)}
                title={path}
              >
                {path}
              </button>
            </li>
          )}
        </For>
        <Show
          when={!folders.read.loading() && !folders.read.current()?.length && !folders.read.error()}
        >
          <li class="muted">{t("Aucun dossier exclu.")}</li>
        </Show>
      </ul>
      <p class="muted">
        {t(
          "Ces dossiers et leurs sous-dossiers ne seront pas parcourus au prochain scan. Les fichiers déjà catalogués seront retirés du catalogue après ce scan, sans supprimer les fichiers audio.",
        )}
      </p>
      <Show when={!library.localSession()}>
        <p class="muted">{t("Démarrez Aède local pour gérer les exclusions.")}</p>
      </Show>
      <Feedback error message={folders.error() || folders.read.error()} persistent />
    </section>
  );
}
