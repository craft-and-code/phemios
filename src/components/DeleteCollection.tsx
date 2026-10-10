import { createEffect, createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { deleteSavedCollection } from "../library/collection-save";
import { Icon } from "./Icon";
/** Confirmation removes a saved rule only, never its albums or source files. */
export function DeleteCollection(props: { name: string; onDeleted: () => void }) {
  const library = useLibrary(),
    [confirm, setConfirm] = createSignal(false),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  createEffect(() => {
    void library.session();
    setConfirm(false);
    setError("");
  });
  const writable = () => !!library.session() && library.session()?.account.role !== "auditor";
  async function remove() {
    const session = library.session(),
      name = props.name,
      source = library.source();
    if (!session || !writable() || busy()) return;
    setBusy(true);
    setError("");
    try {
      if (
        await deleteSavedCollection(
          name,
          source,
          () => session === library.session() && name === props.name,
        )
      ) {
        setConfirm(false);
        props.onDeleted();
      }
    } catch (failure) {
      if (session === library.session()) setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="collection-delete">
      <Show
        when={confirm()}
        fallback={
          <button
            class="icon-button quiet"
            aria-label={t("Supprimer la collection {0}", props.name)}
            disabled={!writable() || busy()}
            onClick={() => setConfirm(true)}
          >
            <Icon name="trash" />
          </button>
        }
      >
        <div
          class="collection-delete-confirm"
          role="group"
          aria-label={t("Supprimer la collection {0}", props.name)}
        >
          <span>{t("Supprimer ?")}</span>
          <button
            class="icon-button quiet"
            disabled={busy()}
            aria-label={t("Confirmer la suppression de {0}", props.name)}
            title={t("Supprimer la collection uniquement")}
            onClick={() => void remove()}
          >
            <Icon name="trash" />
          </button>
          <button
            class="icon-button quiet icon-close"
            disabled={busy()}
            aria-label={t("Annuler")}
            onClick={() => setConfirm(false)}
          >
            <Icon name="close" />
          </button>
        </div>
      </Show>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </div>
  );
}
