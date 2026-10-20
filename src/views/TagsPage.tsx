import { Feedback } from "../components/Feedback";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { CatalogActions } from "../components/CatalogActions";
import { AccountNotice } from "../components/AccountNotice";
import { PageLoader } from "../components/PageLoader";
import { StickyHeader } from "../components/StickyHeader";
import { ResultCount } from "../components/ResultCount";
import { CoverPlay } from "../components/CoverPlay";
import { EmptyState } from "../components/EmptyState";
import { createMemo, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { normalizeName } from "../library/filtering";
import { tagCatalog, taggedEntries, taggedTrackWindow } from "../library/tag-catalog";
import { cachedTagCard, parseTagCard } from "../library/tag-cards";
import { requestAede } from "../platform/desktop";
import { selectTags, additiveCountrySelection, isMac } from "../library/selection";
import { referenceSource } from "../library/sources";
import { SourceBadge } from "../components/SourceBadge";
import { Icon } from "../components/Icon";
import { SelectionCollection } from "../components/SelectionCollection";
import { tagCollectionExpression } from "../library/personal-collection";
/** Every personal tagged target gets a card; unavailable references remain visible in the result count. */
export function TagsPage(props: {
  query: string;
  selected: readonly string[];
  onSelect: (tags: readonly string[]) => void;
  offset: number;
  setOffset: (offset: number) => void;
}) {
  const library = useLibrary(),
    annotations = () => Object.values(library.annotations);
  const [reverse, setReverse] = createSignal(false),
    [compact, setCompact] = createSignal(false);
  const vocabulary = createMemo(() => tagCatalog(annotations()));
  const entries = createMemo(() => {
    const rows = taggedEntries(annotations(), props.selected, props.query);
    return reverse() ? rows.reverse() : rows;
  });
  const offset = () =>
    Math.min(props.offset, Math.max(0, Math.ceil(entries().length / 10) - 1) * 10);
  const targets = () => entries().slice(offset(), offset() + 10);
  const cached = (reference: string) =>
    cachedTagCard(reference, library.artists(), library.albums());
  const details = createDiagnosticRead(
    () => ({
      references: entries().map((row) => row.reference),
      offset: offset(),
      local: library.localSession(),
      server: library.serverSession(),
      snapshot: library.snapshot(),
    }),
    (key, admission) =>
      taggedTrackWindow(
        key.references,
        key.offset,
        async (reference) => {
          const known = cached(reference);
          if (known) return known;
          const session = key[referenceSource(reference)];
          if (!session)
            throw new Error(t("Connectez-vous pour accéder aux données de votre compte."));
          const path = reference.startsWith("artist:")
            ? "artist"
            : reference.startsWith("release:")
              ? "album"
              : reference.startsWith("track:")
                ? "track"
                : undefined;
          if (!path) throw new Error(t("Cet élément n’a pas encore de vue dédiée."));
          const card = parseTagCard(
            await requestAede(
              `/api/v1/${path}`,
              { ref: reference },
              "GET",
              null,
              referenceSource(reference),
              session,
            ),
            reference,
          );
          if (session !== library.sessionFor(reference)) throw new Error(t("Session invalide."));
          return card;
        },
        admission.current,
      ),
  );
  const result = (reference: string) =>
    details.current()?.find((row) => row.reference === reference);
  const card = (reference: string) => {
    const row = result(reference);
    return cached(reference) ?? (row && "track" in row ? row.track : undefined);
  };
  return (
    <section class="page result-page tags-page" classList={{ "density-compact": compact() }}>
      <StickyHeader visible={!!library.localSession() || !!library.serverSession()}>
        <div class="selection-filter-row">
          <ResultCount value={entries().length} />
          <Show when={vocabulary().length}>
            <div class="tag-choices" aria-label={t("Choisir un tag")}>
              <button aria-pressed={!props.selected.length} onClick={() => props.onSelect([])}>
                {t("Tous les tags")}
              </button>
              <For
                each={vocabulary().filter((tag) =>
                  normalizeName(tag.label).includes(normalizeName(props.query)),
                )}
              >
                {(tag) => (
                  <button
                    aria-pressed={props.selected.includes(tag.key)}
                    onClick={(event) =>
                      props.onSelect(
                        selectTags(
                          props.selected,
                          tag.key,
                          additiveCountrySelection(event, isMac()),
                        ),
                      )
                    }
                    title={t("{0} élément(s) tagué(s)", tag.count)}
                  >
                    {tag.label}
                    <span class="tag-count">{tag.count}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <div class="selection-create-action">
            <CatalogActions
              reverseLabel={t("Inverser le tri")}
              reverse={reverse()}
              compact={compact()}
              onReverse={() => {
                props.setOffset(0);
                setReverse(!reverse());
              }}
              onCompact={() => setCompact(!compact())}
            >
              <SelectionCollection
                disabled={
                  !entries().some((row) => referenceSource(row.reference) === library.source())
                }
                expression={tagCollectionExpression(props.selected, props.query)}
              />
            </CatalogActions>
          </div>
        </div>
      </StickyHeader>
      <AccountNotice connected={!!library.localSession() || !!library.serverSession()} />
      <Show when={!entries().length}>
        <EmptyState icon="tags">{t("Aucun élément tagué dans cette sélection.")}</EmptyState>
      </Show>
      <Show when={details.loading()}>
        <PageLoader />
      </Show>
      <Show when={details.error()}>
        <Feedback error persistent message={String(details.error())} />
        <button onClick={() => details.refetch()}>{t("Réessayer")}</button>
      </Show>
      <div class="album-grid tagged-grid">
        <For each={targets()}>
          {(target) => (
            <div class="tagged-card">
              <Show
                when={card(target.reference)}
                fallback={
                  <div class="tagged-placeholder">
                    <Icon name="tags" />
                    <strong>{t("Élément tagué indisponible.")}</strong>
                    <Show when={result(target.reference)}>
                      {(row) => (
                        <Feedback
                          error
                          persistent
                          message={(() => {
                            const value = row();
                            return "error" in value ? value.error : "";
                          })()}
                        />
                      )}
                    </Show>
                    <button onClick={() => details.refetch()}>{t("Réessayer")}</button>
                  </div>
                }
              >
                {(value) => (
                  <div class="tagged-playable">
                    <a
                      class="album-card"
                      href={`#/${value().kind}/${encodeURIComponent(target.reference)}`}
                    >
                      <div class="artwork real-art tagged-artwork">
                        <Show
                          when={
                            library.image(target.reference, "portrait") ??
                            (value().cover ? library.image(value().cover!, "cover") : undefined)
                          }
                          fallback={
                            <Icon
                              name={
                                value().kind === "artist"
                                  ? "users"
                                  : value().kind === "track"
                                    ? "genres"
                                    : "disc"
                              }
                            />
                          }
                        >
                          {(url) => <img src={url()} alt="" decoding="async" />}
                        </Show>
                      </div>
                      <strong>{value().label}</strong>
                    </a>
                    <CoverPlay
                      reference={target.reference}
                      title={value().label}
                      append={compact()}
                    />
                  </div>
                )}
              </Show>
              <SourceBadge reference={target.reference} />
              <Show when={!cached(target.reference) && !target.reference.startsWith("track:")}>
                <button
                  class="metadata-link"
                  disabled={!library.sessionFor(target.reference) || library.busy()}
                  onClick={() => void library.sync(referenceSource(target.reference))}
                >
                  {t("Synchroniser la bibliothèque")}
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={entries().length > 10}>
        <div class="page-controls">
          <button disabled={!offset()} onClick={() => props.setOffset(Math.max(0, offset() - 10))}>
            {t("Précédentes")}
          </button>
          <span>
            {offset() + 1}–{Math.min(offset() + 10, entries().length)} / {entries().length}
          </span>
          <button
            disabled={offset() + 10 >= entries().length}
            onClick={() => props.setOffset(offset() + 10)}
          >
            {t("Suivantes")}
          </button>
        </div>
      </Show>
    </section>
  );
}
