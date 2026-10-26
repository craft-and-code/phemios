import { webEnabled, webMode } from "../web/runtime";
import { composerExpression } from "../library/composers";
import { referenceSource } from "../library/sources";
import { Feedback } from "./Feedback";
import { t } from "../i18n";
import { onMount, onCleanup, Show } from "solid-js";
import { Icon } from "./Icon";
import { useLibrary } from "../library/context";
import { createSelectionCollection } from "../library/selection-collection";
import type { SourceId } from "../library/sources";
import type { Filters } from "../library/types";
/** Freeze the criteria at opening; Aède evaluates their future catalog matches. */
export function SelectionCollection(props: {
  section?: string;
  filters?: Filters;
  expression?: string;
  disabled?: boolean;
  reason?: string | undefined;
  source?: SourceId;
}) {
  const library = useLibrary();
  const source = () => props.source ?? library.source();
  const {
    draft,
    setDraft,
    draftSource,
    name,
    setName,
    error,
    setError,
    busy,
    message,
    setMessage,
    writable,
    save,
    open,
  } = createSelectionCollection(source, (source) =>
    source === "local" ? library.localSession() : library.serverSession(),
  );
  return (
    <div class="selection-collection">
      <button
        class="icon-button"
        disabled={
          (webEnabled() && webMode() === "demo") ||
          !writable() ||
          props.disabled ||
          (props.section === "composers" &&
            !!props.filters?.composers?.some(
              (reference) => referenceSource(reference) !== source(),
            ))
        }
        aria-label={t("Créer une collection depuis cette sélection")}
        title={props.reason ?? t("Créer une collection depuis ces filtres")}
        onClick={() => {
          const criteria = { ...props.filters, view: props.section };
          delete criteria.recentOnly;
          if (!criteria.genres?.length) delete criteria.genres;
          open(
            props.expression ??
              (props.section === "composers" && props.filters
                ? composerExpression(props.filters, source())
                : `browse-v1:${JSON.stringify(criteria)}`),
          );
        }}
      >
        <Icon name="library" />
      </button>
      <Show when={message()}>
        <Feedback
          class="selection-collection-notice"
          message={message()}
          onClose={() => setMessage("")}
        />
      </Show>
      <Show when={draft()}>
        {(_draft) => {
          let dialog: HTMLDialogElement | undefined;
          onMount(() => dialog?.showModal());
          onCleanup(() => dialog?.close());
          return (
            <dialog
              ref={(element) => {
                dialog = element;
              }}
              class="collection-dialog"
              aria-label={t("Créer une collection")}
              onCancel={(e) => {
                e.preventDefault();
                if (!busy()) setDraft(undefined);
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy()) setDraft(undefined);
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div class="section-heading">
                  <h2>
                    {t("Créer une collection ·")}{" "}
                    {draftSource() === "local" ? t("Local") : t("Serveur")}
                  </h2>
                  <button
                    type="button"
                    class="icon-button quiet icon-close"
                    aria-label={t("Fermer")}
                    disabled={busy()}
                    onClick={() => setDraft(undefined)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <p>{t("La collection conservera les critères de cette sélection.")} </p>
                <div class="collection-name-row">
                  <label>
                    {t("Nom")}{" "}
                    <input
                      autofocus
                      required
                      maxlength="128"
                      value={name()}
                      onInput={(e) => setName(e.currentTarget.value)}
                    />
                  </label>
                  <button class="primary" disabled={!writable() || busy()}>
                    <Show when={busy()}>{<span class="spinner" />}</Show>
                    {t("Créer la collection")}
                  </button>
                </div>
                <Feedback error message={error()} onClose={() => setError("")} />
              </form>
            </dialog>
          );
        }}
      </Show>
    </div>
  );
}
