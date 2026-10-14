import { Feedback } from "../components/Feedback";
import { restoreTrackCache } from "../library/track-recovery";
import type { SourceId } from "../library/sources";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { RefreshButton } from "../components/RefreshButton";
import { PageLoader } from "../components/PageLoader";
import { TracksHeader } from "../components/TracksHeader";
import { pageSizes } from "../library/tool-preferences";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { t } from "../i18n";
import { createMemo, createSignal, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { publicCatalogSources, cachedTrackPage } from "../library/offline-catalog";
import { combinedTrackReader } from "../library/combined-tracks";
import { sourceLabel } from "../library/sources";
import { TrackResults } from "../components/TrackResults";
/** All catalog placements, including albumless tracks, use bounded server search pages. */
export function TracksPage(props: {
  query: string;
  size: number;
  setSize: (size: number) => void;
  preferenceError: string;
  offset: number;
  setOffset: (value: number) => void;
}) {
  const library = useLibrary(),
    offset = () => props.offset,
    setOffset = props.setOffset;
  const sources = createMemo(() =>
    publicCatalogSources(library.publicSnapshot, library.trackSources()),
  );
  const [revision, setRevision] = createSignal(0),
    [retry, setRetry] = createSignal<{ source: SourceId } | false>(false);
  const recovery = createDiagnosticRead(retry, async (key, admission) => {
    const restored = await restoreTrackCache(
      key.source,
      {
        connected: !!(key.source === "local" ? library.localSession() : library.serverSession()),
        connectLocal: library.enableLocal,
        sync: library.sync,
        hasTracks: (source) => !!library.publicSnapshot(source)?.tracks,
        failure: library.error,
      },
      admission.current,
    );
    if (restored && admission.current()) setRevision((value) => value + 1);
  });
  const reader = createMemo(() => {
    revision();
    const choices = sources(),
      query = props.query;
    if (!choices.length) return undefined;
    const cached = new Set<string>();
    const read = combinedTrackReader(choices, async (source, at) => {
      const choice = choices.find((row) => row.source === source)!;
      if (choice.online) {
        try {
          return await requestAede(
            "/api/v1/presentation/tracks",
            { offset: String(at), limit: "50", q: query },
            "GET",
            null,
            source,
          );
        } catch (failure) {
          if (!choice.snapshot?.tracks) throw failure;
        }
      }
      cached.add(source);
      return cachedTrackPage(choice.snapshot, query, at);
    });
    return async (offset: number, size: number) => ({
      ...(await read(offset, size)),
      cached: [...cached],
    });
  });
  const read = createDiagnosticRead(
    () => (reader() ? { read: reader()!, offset: offset(), size: props.size } : false),
    (key) => key.read(key.offset, key.size),
  );
  const page = read.current;
  return (
    <section class="page result-page tracks-page">
      <TracksHeader
        total={page()?.total ?? 0}
        offset={offset()}
        size={props.size}
        sizes={pageSizes}
        busy={recovery.loading() || read.loading()}
        pending={recovery.pending() || read.pending()}
        onCancel={() => {
          recovery.cancel();
          read.cancel();
        }}
        onSize={props.setSize}
        onRefresh={() => {
          const missing = page()?.unavailable[0];
          if (missing) setRetry({ source: missing.source });
          else setRevision((value) => value + 1);
        }}
      />
      <div class="tracks-results">
        <Show when={props.preferenceError}>
          <p role="alert">{props.preferenceError}</p>
        </Show>
        <Show when={!reader()}>
          <EmptyState icon="list">{t("Aucune piste dans cette recherche.")}</EmptyState>
        </Show>
        <Feedback error persistent message={recovery.error() || read.error()} />
        <Show when={read.loading() && !page()}>
          <PageLoader inline label={t("Chargement des pistes…")} />
        </Show>
        <Show when={!read.error() && page()}>
          {(value) => (
            <>
              <For each={value().unavailable}>
                {(issue) => (
                  <div class="track-recovery-row">
                    <Feedback
                      error
                      persistent
                      message={`${sourceLabel(issue.source)} · ${issue.error.replace(/^Error: /, "")}`}
                    />
                    <RefreshButton
                      label={t("Synchroniser la bibliothèque")}
                      busy={recovery.loading()}
                      disabled={
                        (library.busy() && !recovery.loading()) ||
                        (recovery.pending() && !recovery.loading())
                      }
                      onCancel={recovery.cancel}
                      onRefresh={() => setRetry({ source: issue.source })}
                    />
                  </div>
                )}
              </For>
              <Show when={props.query.trim() && value().cached.length}>
                <p class="notice">
                  {t("Recherche hors connexion : titres des pistes et des albums enregistrés.")}
                </p>
              </Show>
              <Show when={!value().items.length}>
                <EmptyState icon="list">{t("Aucune piste dans cette recherche.")}</EmptyState>
              </Show>
              <ol class="track-list">
                <For each={value().items}>
                  {(track, index) => (
                    <>
                      <TrackResults
                        track={track}
                        number={offset() + index() + 1}
                        origin
                        onPlay={() => void library.player.startReference(track.reference)}
                        context={
                          <>
                            <Show when={track.release} fallback={t("Sans album")}>
                              {(reference) => (
                                <a href={`#/album/${encodeURIComponent(reference())}`}>
                                  {track.album_title}
                                </a>
                              )}
                            </Show>
                            <Show when={track.disc_no}>
                              {" "}
                              {t("· CD")} {track.disc_no}
                            </Show>
                            <Show when={track.track_no}>
                              {" "}
                              {t("· Piste")} {track.track_no}
                            </Show>
                          </>
                        }
                      />
                    </>
                  )}
                </For>
              </ol>
            </>
          )}
        </Show>
      </div>
      <Pagination
        offset={offset()}
        size={props.size}
        total={page()?.total ?? 0}
        count={page()?.items.length ?? 0}
        busy={recovery.pending() || read.pending()}
        onOffset={setOffset}
      />
    </section>
  );
}
