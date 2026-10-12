import { createMemo, createSignal, createEffect, on, onCleanup, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { createM3UBrowser } from "../library/m3u-browser";
import type { M3UKind } from "../library/m3u-files";
import { downloadM3U } from "../components/M3UExport";
import { PageLoader } from "../components/PageLoader";
import { Feedback } from "../components/Feedback";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { t } from "../i18n";
/** Existing folder files and owner-private exports stay distinct, with inert previews and exact downloads. */
export function M3UPage(props: { query: string }) {
  const library = useLibrary(),
    [kind, setKind] = createSignal<M3UKind>("files"),
    [offset, setOffset] = createSignal(0),
    [query, setQuery] = createSignal(props.query.trim()),
    [message, setMessage] = createSignal(""),
    [failed, setFailed] = createSignal(false),
    [busy, setBusy] = createSignal(false);
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  createEffect(
    on(
      () => props.query,
      (value) => {
        const timer = setTimeout(() => {
          setOffset(0);
          setQuery(value.trim());
        }, 250);
        onCleanup(() => clearTimeout(timer));
      },
      { defer: true },
    ),
  );
  const scope = createMemo(() => {
    const session = library.session();
    return session
      ? { session, source: library.source(), kind: kind(), offset: offset(), query: query() }
      : undefined;
  });
  const reads = createM3UBrowser(scope, (path, query, source) =>
    requestAede(path, query, "GET", null, source),
  );
  createEffect(on(scope, () => setMessage(""), { defer: true }));
  async function download() {
    const held = scope(),
      file = reads.detail();
    if (!held || !file || busy()) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const path = await downloadM3U(file);
      if (!disposed && reads.isCurrentFile(held, file.id))
        setMessage(t("M3U téléchargé : {0}", path));
    } catch (failure) {
      if (!disposed && reads.isCurrentFile(held, file.id)) {
        setFailed(true);
        setMessage(String(failure));
      }
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  function choose(next: M3UKind) {
    setOffset(0);
    setKind(next);
  }
  return (
    <section class="page m3u-page">
      <div class="m3u-toolbar">
        <div class="choices" aria-label={t("Origine des listes M3U")}>
          <button aria-pressed={kind() === "files"} onClick={() => choose("files")}>
            {t("Fichiers de la bibliothèque")}
          </button>
          <button aria-pressed={kind() === "exports"} onClick={() => choose("exports")}>
            {t("Exports enregistrés")}
          </button>
        </div>
        <Show when={reads.page()}>
          {(page) => <span class="muted">{t("{0} liste(s)", page().total)}</span>}
        </Show>
        <button
          class="icon-button"
          aria-label={t("Actualiser les listes M3U")}
          title={t("Actualiser les listes M3U")}
          disabled={!library.session() || reads.refreshing()}
          onClick={() => {
            void reads.refetch();
            if (reads.selected()) void reads.retryDetail();
          }}
        >
          <Show when={reads.refreshing()} fallback={<Icon name="refresh" />}>
            <span class="spinner" />
          </Show>
        </button>
      </div>
      <Feedback message={message()} error={failed()} onClose={() => setMessage("")} />
      <Feedback error message={reads.error()} />
      <Show
        when={
          reads.page() && (reads.page()!.unavailable_roots || reads.page()!.unreadable_directories)
        }
      >
        <Feedback
          error
          message={t(
            "Inventaire partiel : {0} dossier(s) indisponible(s), {1} répertoire(s) illisible(s).",
            reads.page()!.unavailable_roots,
            reads.page()!.unreadable_directories,
          )}
        />
      </Show>
      <Show when={reads.loading()}>
        <PageLoader />
      </Show>
      <Show
        when={reads.page()?.items.length}
        fallback={
          <Show when={!reads.loading() && !reads.error()}>
            <EmptyState icon="playlist">
              {!library.session()
                ? t("Connectez votre bibliothèque pour afficher ses listes M3U.")
                : kind() === "files"
                  ? t("Aucun fichier M3U dans cette sélection.")
                  : t("Aucun export M3U enregistré.")}
            </EmptyState>
          </Show>
        }
      >
        <div class="m3u-workspace">
          <ul class="m3u-library">
            <For each={reads.page()?.items}>
              {(row) => (
                <li>
                  <button
                    aria-pressed={reads.selected() === row.id}
                    onClick={() => reads.select(row.id)}
                  >
                    <Icon name="playlist" />
                    <span class="m3u-row-name">
                      <strong>{row.name}</strong>
                      <Show when={row.path}>
                        <small title={row.path}>{row.path}</small>
                      </Show>
                    </span>
                    <Show when={row.track_count !== null}>
                      <small>{t("{0} pistes", row.track_count)}</small>
                    </Show>
                  </button>
                </li>
              )}
            </For>
          </ul>
          <section class="m3u-preview">
            <Show when={reads.detailLoading()}>
              <PageLoader inline />
            </Show>
            <Show when={reads.detailError()}>
              <div class="error-retry">
                <Feedback error message={reads.detailError()} />
                <button
                  class="icon-button"
                  aria-label={t("Réessayer")}
                  title={t("Réessayer")}
                  disabled={reads.detailLoading()}
                  onClick={() => void reads.retryDetail()}
                >
                  <Icon name="refresh" />
                </button>
              </div>
            </Show>
            <Show
              when={reads.detail()}
              fallback={
                <Show when={!reads.selected()}>
                  <EmptyState icon="playlist">{t("Sélectionnez une liste M3U.")}</EmptyState>
                </Show>
              }
            >
              {(file) => (
                <>
                  <div class="section-heading">
                    <h2>{file().name}</h2>
                    <button
                      class="icon-button"
                      title={t("Télécharger le M3U")}
                      aria-label={t("Télécharger le M3U")}
                      disabled={busy() || reads.detailLoading()}
                      onClick={() => void download()}
                    >
                      <Show when={busy()} fallback={<Icon name="download" />}>
                        <span class="spinner" />
                      </Show>
                    </button>
                  </div>
                  <Show when={file().path}>
                    <p class="muted m3u-file-path">{file().path}</p>
                  </Show>
                  <p class="muted">{t("{0} pistes", file().titles.length)}</p>
                  <Show
                    when={file().titles.length}
                    fallback={
                      <EmptyState icon="playlist">{t("Cette liste M3U est vide.")}</EmptyState>
                    }
                  >
                    <ol>
                      <For each={file().titles}>{(title) => <li>{title}</li>}</For>
                    </ol>
                  </Show>
                </>
              )}
            </Show>
          </section>
        </div>
      </Show>
      <Show when={(reads.page()?.total ?? 0) > 50}>
        <div class="page-controls">
          <button
            class="icon-button"
            title={t("Précédentes")}
            aria-label={t("Précédentes")}
            disabled={!offset() || reads.refreshing()}
            onClick={() => setOffset(Math.max(0, offset() - 50))}
          >
            <Icon name="back" />
          </button>
          <span>
            {offset() + 1}–{offset() + (reads.page()?.items.length ?? 0)} / {reads.page()?.total}
          </span>
          <button
            class="icon-button"
            title={t("Suivantes")}
            aria-label={t("Suivantes")}
            disabled={offset() + 50 >= (reads.page()?.total ?? 0) || reads.refreshing()}
            onClick={() => setOffset(offset() + 50)}
          >
            <Icon name="forward" />
          </button>
        </div>
      </Show>
    </section>
  );
}
