import { useViewSession } from "../navigation/ViewSession";
import { Feedback } from "../components/Feedback";
import { AlbumCount } from "../components/AlbumCount";
import { StickyHeader } from "../components/StickyHeader";
import { PageLoader } from "../components/PageLoader";
import { EmptyState } from "../components/EmptyState";
import { createMemo, createSignal, createResource, createEffect, on, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { publicCatalogSources, cachedLabelPage } from "../library/offline-catalog";
import { parseLabelPage } from "../library/labels";
import { sourceLabel } from "../library/sources";
import { SourceBadge } from "../components/SourceBadge";
import { CoverPlay } from "../components/CoverPlay";
import { Icon } from "../components/Icon";
/** Explicit bounded browsing never fetches biographies from external providers. */
export function LabelsPage(props: { query: string }) {
  const library = useLibrary(),
    [offset, setOffset] = createSignal(0);
  const [sort, setSort] = useViewSession().control("labelsSort"),
    [descending, setDescending] = useViewSession().control("labelsDescending");
  const sources = createMemo(() =>
    publicCatalogSources(library.publicSnapshot, library.trackSources()),
  );
  const [pages] = createResource(
    () => ({
      sources: sources(),
      query: props.query,
      offset: offset(),
      sort: sort(),
      descending: descending(),
    }),
    async (key) => {
      return Promise.all(
        key.sources.map(async (source) => {
          try {
            const cached = () =>
              cachedLabelPage(source.snapshot, key.query, key.offset, key.sort, key.descending);
            let page;
            if (source.online) {
              let raw: unknown;
              try {
                raw = await requestAede(
                  "/api/v1/labels",
                  {
                    offset: String(key.offset),
                    limit: "50",
                    sort: key.sort,
                    order: key.descending ? "desc" : "asc",
                    ...(key.query.trim() ? { q: key.query.trim() } : {}),
                  },
                  "GET",
                  undefined,
                  source.source,
                );
              } catch (failure) {
                if (!source.snapshot?.labels) throw failure;
                page = cached();
              }
              if (page === undefined)
                page = parseLabelPage(raw, key.offset, source.source, source.scannedAt);
            } else page = cached();
            return {
              ...page,
              source: source.source,
              offset: key.offset,
              identity: source.identity,
              query: key.query,
              sort: key.sort,
              descending: key.descending,
            };
          } catch (failure) {
            return {
              items: [],
              total: 0,
              source: source.source,
              offset: key.offset,
              identity: source.identity,
              query: key.query,
              sort: key.sort,
              descending: key.descending,
              error: String(failure),
            };
          }
        }),
      );
    },
  );
  createEffect(
    on(
      () => [props.query, sort(), descending()],
      () => setOffset(0),
    ),
  );
  const current = () =>
    pages()?.filter(
      (page) =>
        page.offset === offset() &&
        page.query === props.query &&
        page.sort === sort() &&
        page.descending === descending() &&
        sources().some(
          (source) => source.source === page.source && source.identity === page.identity,
        ),
    ) ?? [];
  return (
    <section class="page labels-page">
      <StickyHeader>
        <div class="label-toolbar">
          <button
            class="icon-button"
            title={t("Trier par nom")}
            aria-label={t("Trier par nom")}
            aria-pressed={sort() === "name"}
            onClick={() => {
              setSort("name");
              setOffset(0);
            }}
          >
            <Icon name="alphabet" />
          </button>
          <button
            class="icon-button"
            title={t("Trier par nombre d’albums")}
            aria-label={t("Trier par nombre d’albums")}
            aria-pressed={sort() === "albums"}
            onClick={() => {
              setSort("albums");
              setOffset(0);
            }}
          >
            <Icon name="disc" />
          </button>
          <button
            class="icon-button"
            title={t("Inverser le tri")}
            aria-label={t("Inverser le tri")}
            aria-pressed={descending()}
            onClick={() => {
              setDescending(!descending());
              setOffset(0);
            }}
          >
            <Icon name="sort" />
          </button>
        </div>
      </StickyHeader>
      <Show when={!sources().length}>
        <EmptyState icon="label">{t("Aucun label dans cette sélection.")}</EmptyState>
      </Show>
      <Show when={pages.loading}>
        <PageLoader />
      </Show>
      <div class="label-grid">
        <For each={current()}>
          {(page) => (
            <>
              <Show when={"error" in page}>
                <Feedback
                  error
                  persistent
                  message={"error" in page ? `${sourceLabel(page.source)} · ${page.error}` : ""}
                />
              </Show>
              <For each={page.items}>
                {(label) => (
                  <div class="label-row">
                    <a class="label-link" href={`#/label/${encodeURIComponent(label.reference)}`}>
                      <strong title={label.name}>{label.name}</strong>
                      <small>
                        <AlbumCount value={label.releaseCount} />
                      </small>
                      <SourceBadge reference={label.reference} />
                    </a>
                    <CoverPlay
                      reference={label.reference}
                      title={label.name}
                      class="label-play"
                      append
                    />
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
          sources().length &&
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
