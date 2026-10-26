import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import { useLibrary } from "../library/context";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { readSourceReviews } from "../library/source-review-read";
import {
  hasSourceReviewPages,
  decideSourceReview,
  type SourceReviewItem,
  type ReviewDecision,
} from "../library/source-review";
import { applySourceReview } from "../library/source-review-actions";
import { hasActiveEnrichment } from "../library/enrichment";
import { sourceLabel, type SourceId } from "../library/sources";
import { ActionButton } from "../components/ActionButton";
import { RefreshButton } from "../components/RefreshButton";
import { Pagination } from "../components/Pagination";
import { Feedback } from "../components/Feedback";
import { SourceReviewCard } from "../components/SourceReviewCard";
import { t } from "../i18n";
/** Administrators review the common catalogue independently on each connected engine. */
export function SettingsSourceReview() {
  const library = useLibrary();
  const sources = () =>
    (["local", "server"] as const).filter(
      (s) =>
        (s === "local" ? library.localSession() : library.serverSession())?.account.role ===
        "admin",
    );
  return (
    <section class="source-review-section">
      <h3>{t("Correspondances MusicBrainz")}</h3>
      <p class="muted">
        {t(
          "Vérifiez l’identité proposée avant de récupérer une biographie. Ces décisions s’appliquent au catalogue commun ; vos fichiers audio et leurs tags restent intacts.",
        )}
      </p>
      <For
        each={sources()}
        fallback={<p class="notice">{t("Droits administrateur nécessaires.")}</p>}
      >
        {(source) => <SourceReviewLibrary source={source} />}
      </For>
    </section>
  );
}
function SourceReviewLibrary(props: { source: SourceId }) {
  const library = useLibrary();
  const owner = () => (props.source === "local" ? library.localSession() : library.serverSession());
  const [draft, setDraft] = createSignal(""),
    [query, setQuery] = createSignal(""),
    [all, setAll] = createSignal(false),
    [offset, setOffset] = createSignal(0);
  const [busy, setBusy] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [failure, setFailure] = createSignal(false);
  let alive = true,
    generation = 0;
  onCleanup(() => {
    alive = false;
    generation++;
  });
  createEffect(() => {
    void owner();
    void props.source;
    generation++;
    setBusy("");
    setMessage("");
    setDraft("");
    setQuery("");
    setOffset(0);
    setAll(false);
  });
  const read = createDiagnosticRead(
    () =>
      owner()?.account.role === "admin"
        ? { source: props.source, owner: owner()!, query: query(), all: all(), offset: offset() }
        : false,
    (key, admission) => readSourceReviews(key, admission.current),
  );
  const occupied = () =>
    library.tasks.enrichmentPending() || hasActiveEnrichment(library.tasks.jobs());
  async function act(row: SourceReviewItem, decision?: ReviewDecision, biography = false) {
    const session = owner(),
      source = props.source,
      epoch = generation;
    if (!session || session.account.role !== "admin" || busy() || (biography && occupied())) return;
    const current = () =>
      alive && owner() === session && props.source === source && epoch === generation;
    setBusy(row.id);
    setMessage("");
    setFailure(false);
    try {
      const result = await applySourceReview({
        row,
        ...(decision ? { decision } : {}),
        biography,
        current,
        decide: (action) => decideSourceReview(source, session, row, action),
        saved: () => {
          if (current()) void read.refetch();
        },
        launch: async (options) => (await library.tasks.enrich([source], options))?.[0],
      });
      if (current()) setMessage(result);
    } catch (error) {
      if (current()) {
        setFailure(true);
        setMessage(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (current()) {
        setBusy("");
        void read.refetch();
      }
    }
  }
  return (
    <section class="source-review-library">
      <div class="source-review-heading">
        <strong>{sourceLabel(props.source)}</strong>
        <RefreshButton
          identity={owner()}
          busy={read.loading()}
          pending={read.pending()}
          disabled={!!busy()}
          onRefresh={() => read.refetch()}
          onCancel={read.cancel}
        />
      </div>
      <form
        class="source-review-search"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          if (query() === draft().trim()) void read.refetch();
          else setQuery(draft().trim());
        }}
      >
        <input
          aria-label={t("Rechercher une correspondance")}
          placeholder={t("Artiste, album…")}
          maxlength={1024}
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
        />
        <ActionButton type="submit" icon="search" disabled={read.pending() || !!busy()}>
          {t("Rechercher")}
        </ActionButton>
      </form>
      <label class="check">
        <input
          type="checkbox"
          checked={all()}
          disabled={!!busy()}
          onChange={(event) => {
            setOffset(0);
            setAll(event.currentTarget.checked);
          }}
        />
        {t("Afficher aussi les correspondances déjà traitées")}
      </label>
      <Feedback error persistent message={read.error()} />
      <Feedback error={failure()} message={message()} onClose={() => setMessage("")} />
      <Show when={read.loading() && !read.current()}>
        <div class="source-review-loading">
          <span class="spinner" role="status" aria-label={t("Chargement")} />
        </div>
      </Show>
      <Show when={read.current()}>
        {(page) => (
          <>
            <Show when={!page().biographies}>
              <p class="notice">
                {t(
                  "Mettez à jour puis redémarrez Aède pour récupérer la biographie de cet artiste.",
                )}
              </p>
            </Show>
            <p class="muted">{t("{0} correspondance(s)", page().total)}</p>
            <For
              each={page().items}
              fallback={
                <p class="source-review-empty">
                  {t("Aucune correspondance à valider dans cette sélection.")}
                </p>
              }
            >
              {(row) => (
                <SourceReviewCard
                  row={row}
                  busy={busy() === row.id}
                  disabled={!!busy() || read.loading()}
                  biographyAvailable={page().biographies && !occupied()}
                  onDecision={(decision) => void act(row, decision)}
                  onBiography={() =>
                    void act(row, row.decision === "accepted" ? undefined : "accept", true)
                  }
                />
              )}
            </For>
            <Show when={hasSourceReviewPages(page())}>
              <Pagination
                offset={page().offset}
                size={page().limit}
                count={page().items.length}
                total={page().total}
                busy={!!busy() || read.pending()}
                onOffset={setOffset}
              />
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
