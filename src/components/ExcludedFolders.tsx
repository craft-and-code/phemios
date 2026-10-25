import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { ObjectList } from "./ObjectList";
import { createExcludedFolderOrder } from "../library/excluded-folder-order";
import { createExcludedFolders } from "../library/excluded-folders";
import { localRootAction, pickLocalExclusions, requestAede } from "../platform/desktop";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** A read-only path list permits selection/removal without typing or modifying folder names. */
export function ExcludedFolders(props: { disabled: boolean }) {
  const library = useLibrary();
  let list: HTMLUListElement;
  const folders = createExcludedFolders({
    session: library.localSession,
    order: createExcludedFolderOrder(localStorage),
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
  const remove = async () => {
    const held = library.localSession();
    await folders.remove();
    if (library.localSession() === held && list?.isConnected) list.focus();
  };
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
            title={
              folders.selections().length > 1
                ? t("Retirer les exclusions sélectionnées")
                : t("Retirer l’exclusion sélectionnée")
            }
            aria-label={
              folders.selections().length > 1
                ? t("Retirer les exclusions sélectionnées")
                : t("Retirer l’exclusion sélectionnée")
            }
            disabled={disabled() || !folders.selection()}
            onClick={() => void remove()}
          >
            <Icon name="minus" />
          </button>
        </div>
      </div>
      <ObjectList
        label={t("Dossiers exclus du scan")}
        items={folders.read.current() ?? []}
        selected={folders.selection()}
        selectedItems={folders.selections()}
        onSelect={folders.select}
        onSelectMany={folders.selectMany}
        onDelete={disabled() ? undefined : remove}
        onReorder={disabled() ? undefined : folders.move}
        identity={library.localSession()}
        listRef={(node) => {
          list = node;
        }}
        disabled={folders.busy() || folders.read.pending()}
        busy={folders.read.loading() || folders.busy()}
        empty={
          folders.read.error()
            ? t("Liste indisponible.")
            : folders.read.loading()
              ? t("Lecture des exclusions…")
              : t("Aucun dossier exclu.")
        }
      />
      <p class="muted">
        {t(
          "Maj+clic ou Maj+flèches sélectionne une plage, Ctrl/⌘+clic des lignes séparées, Ctrl+A (⌘A sur Mac) tout. Suppr ou − retire la sélection. Glisser-déposer ou Alt+flèches déplace une ligne.",
        )}
      </p>
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
