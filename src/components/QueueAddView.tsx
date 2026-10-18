import { Pagination } from "./Pagination";
import { LibraryPickerRow } from "./LibraryPickerRow";
import { For, Show, onMount, createMemo } from "solid-js";
import { t } from "../i18n";
import {
  queueCategoryLabels,
  type QueueCategory,
  type QueueSearchItem,
} from "../library/queue-search";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
import { RefreshButton } from "./RefreshButton";
/** Compact queue composer presentation; admission and authenticated reads belong to its controller. */
export function QueueAddView(props: {
  title?: string | undefined;
  footer?: string | undefined;
  actionLabel?: ((row: QueueSearchItem) => string) | undefined;
  category: QueueCategory;
  query: string;
  rows: readonly QueueSearchItem[];
  loading: boolean;
  pending: string;
  added: string;
  error: string;
  more: boolean;
  offset: number;
  origins: boolean;
  image: (row: QueueSearchItem) => string | undefined;
  disabled: (row: QueueSearchItem) => string;
  onQuery: (value: string) => void;
  onSearch?: (() => void) | undefined;
  onCategory: (value: QueueCategory) => void;
  onAdd: (row: QueueSearchItem) => void;
  onOffset: (offset: number) => void;
  onClose?: (() => void) | undefined;
  onRefresh: () => void;
  onCancel: () => void;
}) {
  let input: HTMLInputElement | undefined;
  onMount(() => input?.focus());
  const categories = Object.entries(queueCategoryLabels) as [QueueCategory, string][];
  return (
    <section class="queue-add-panel" aria-label={props.title ?? t("Ajouter à la suite")}>
      <div class="queue-add-heading">
        <h3>{props.title ?? t("Ajouter à la suite")}</h3>
        <Show when={props.onClose}>
          <button
            class="icon-button quiet icon-close"
            aria-label={t("Fermer la recherche")}
            onClick={props.onClose}
          >
            <Icon name="close" />
          </button>
        </Show>
      </div>
      <input
        ref={(element) => {
          input = element;
        }}
        type="search"
        maxlength="512"
        aria-label={t("Rechercher dans la bibliothèque")}
        placeholder={t("Rechercher dans la bibliothèque…")}
        value={props.query}
        onInput={(e) => props.onQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            props.onSearch?.();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            props.onClose?.();
          }
        }}
      />
      <div class="queue-add-categories" aria-label={t("Type de contenu")}>
        <For each={categories}>
          {([key, label]) => (
            <button
              type="button"
              aria-pressed={props.category === key}
              onClick={() => props.onCategory(key)}
            >
              {t(label)}
            </button>
          )}
        </For>
      </div>
      <Show when={props.error}>
        <Feedback message={props.error} error />
      </Show>
      <div class="queue-add-results" aria-busy={props.loading}>
        <Show when={props.loading}>
          <div class="queue-add-loading">
            <span class="spinner" role="status" aria-label={t("Chargement")} />
          </div>
        </Show>
        <Show when={!props.loading}>
          <For each={props.rows}>
            {(row) => {
              const reason = createMemo(() => props.disabled(row));
              return (
                <LibraryPickerRow
                  title={row.title}
                  image={props.image(row)}
                  icon={
                    row.playlist
                      ? "playlist"
                      : row.collection
                        ? "library"
                        : row.reference?.startsWith("artist:")
                          ? "users"
                          : "disc"
                  }
                  detailTitle={row.detail}
                  detail={
                    <>
                      <Show when={props.category === "all" && row.category}>
                        {t(queueCategoryLabels[row.category!])}
                        {" · "}
                      </Show>
                      {row.detail}
                      <Show when={props.origins}>
                        {" · "}
                        {row.source === "local" ? t("Local") : t("Serveur")}
                      </Show>
                    </>
                  }
                  reason={!props.pending ? reason() : ""}
                  action={
                    <button
                      class="icon-button quiet"
                      classList={{ "download-complete": props.added === row.key }}
                      disabled={!!props.pending || !!reason()}
                      title={
                        reason() ||
                        (props.actionLabel?.(row) ?? t("Ajouter {0} à la suite", row.title))
                      }
                      aria-label={
                        props.actionLabel?.(row) ?? t("Ajouter {0} à la suite", row.title)
                      }
                      aria-busy={props.pending === row.key}
                      onClick={() => props.onAdd(row)}
                    >
                      <Show
                        when={props.pending === row.key}
                        fallback={<Icon name={props.added === row.key ? "check" : "plus"} />}
                      >
                        <span class="spinner" />
                      </Show>
                    </button>
                  }
                />
              );
            }}
          </For>
          <Show when={!props.rows.length && !props.error}>
            <p class="muted queue-add-empty">{t("Aucun résultat dans cette sélection.")}</p>
          </Show>
        </Show>
      </div>
      <div class="queue-add-footer">
        <small class="muted">{props.footer ?? t("Ajout à la fin de la liste")}</small>
        <div>
          <Pagination
            compact
            offset={props.offset}
            size={50}
            count={props.rows.length}
            more={props.more}
            busy={props.loading}
            onOffset={props.onOffset}
          />
          <Show when={props.error}>
            <RefreshButton
              busy={props.loading}
              onRefresh={props.onRefresh}
              onCancel={props.onCancel}
            />
          </Show>
        </div>
      </div>
    </section>
  );
}
