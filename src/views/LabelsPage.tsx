import { EmptyState } from "../components/EmptyState";
import { createSignal, createResource, createEffect, on, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseLabelPage } from "../library/labels";
import { sourceLabel } from "../library/sources";
import { SourceBadge } from "../components/SourceBadge";
import { CoverPlay } from "../components/CoverPlay";
import { Icon } from "../components/Icon";
/** Explicit bounded browsing never fetches biographies from external providers. */
export function LabelsPage(props: { query: string }) {
  const library = useLibrary(),
    [offset, setOffset] = createSignal(0);
  const [pages] = createResource(
    () => ({ sources: library.trackSources(), query: props.query, offset: offset() }),
    async (key) => {
      return Promise.all(
        key.sources.map(async (source) => {
          try {
            const page = parseLabelPage(
              await requestAede(
                "/api/v1/labels",
                {
                  offset: String(key.offset),
                  limit: "50",
                  sort: "name",
                  ...(key.query.trim() ? { q: key.query.trim() } : {}),
                },
                "GET",
                undefined,
                source.source,
              ),
              key.offset,
              source.source,
              source.scannedAt,
            );
            return { ...page, source: source.source, identity: source.identity, query: key.query };
          } catch (failure) {
            return {
              items: [],
              total: 0,
              source: source.source,
              identity: source.identity,
              query: key.query,
              error: String(failure),
            };
          }
        }),
      );
    },
  );
  createEffect(
    on(
      () => props.query,
      () => setOffset(0),
    ),
  );
  const current = () =>
    pages()?.filter(
      (page) =>
        page.query === props.query &&
        library
          .trackSources()
          .some((source) => source.source === page.source && source.identity === page.identity),
    ) ?? [];
  return (
    <section class="page labels-page">
      <Show when={!library.trackSources().length}>
        <p class="notice">{t("Connectez-vous pour parcourir les labels de votre bibliothèque.")}</p>
      </Show>
      <Show when={pages.loading}>
        <p role="status">{t("Chargement…")}</p>
      </Show>
      <div class="label-grid">
        <For each={current()}>
          {(page) => (
            <>
              <Show when={"error" in page}>
                <p role="alert">
                  {sourceLabel(page.source)} · {"error" in page ? page.error : ""}
                </p>
              </Show>
              <For each={page.items}>
                {(label) => (
                  <div class="label-row">
                    <a class="label-link" href={`#/label/${encodeURIComponent(label.reference)}`}>
                      <strong title={label.name}>{label.name}</strong>
                      <small>{t("{0} albums", label.releaseCount)}</small>
                      <SourceBadge reference={label.reference} />
                    </a>
                    <CoverPlay reference={label.reference} title={label.name} class="label-play" />
                  </div>
                )}
              </For>
            </>
          )}
        </For>
      </div>
      <Show
        when={
          !pages.loading &&
          library.trackSources().length &&
          current().every((page) => !page.total && !("error" in page))
        }
      >
        <EmptyState icon="label">{t("Aucun label dans cette sélection.")}</EmptyState>
      </Show>
      <Show when={current().some((page) => page.total > 50) || offset()}>
        <nav class="page-controls" aria-label={t("Pages des labels")}>
          <button
            class="icon-button quiet"
            aria-label={t("Précédent")}
            title={t("Précédent")}
            disabled={!offset()}
            onClick={() => setOffset(Math.max(0, offset() - 50))}
          >
            <Icon name="back" />
          </button>
          <span>{t("Page {0}", offset() / 50 + 1)}</span>
          <button
            class="icon-button quiet"
            aria-label={t("Suivant")}
            title={t("Suivant")}
            disabled={!current().some((page) => page.total > offset() + 50)}
            onClick={() => setOffset(offset() + 50)}
          >
            <Icon name="forward" />
          </button>
        </nav>
      </Show>
    </section>
  );
}
