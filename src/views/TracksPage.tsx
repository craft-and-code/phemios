import { FilterBar } from "../components/FilterBar";
import { Icon } from "../components/Icon";
import { SelectionCollection } from "../components/SelectionCollection";
import {
  trackBrowsePage,
  trackBrowseRows,
  trackCollectionExpression,
} from "../library/track-browsing";
import { initialIndex } from "../library/filtering";
import type { Filters, Interval } from "../library/types";
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
  filters: Filters;
  onFilters: (value: Filters) => void;
  reverse: boolean;
  onReverse: () => void;
  yearDomain: Interval;
  size: number;
  setSize: (size: number) => void;
  preferenceError: string;
  offset: number;
  setOffset: (value: number) => void;
}) {
  const library = useLibrary(),
    offset = () => props.offset,
    setOffset = props.setOffset;
  const refreshIdentity = createMemo(() => ({
    local: library.localSession(),
    server: library.serverSession(),
  }));
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
      query = props.query,
      filters = { ...props.filters, query },
      reverse = props.reverse;
    const restricted =
      reverse ||
      (["years", "both"].includes(filters.mode) &&
        (filters.years[0] !== props.yearDomain[0] ||
          filters.years[1] !== props.yearDomain[1] ||
          !filters.includeUnknownYear)) ||
      (["alphabet", "both"].includes(filters.mode) &&
        (filters.alphabet[0] !== 0 || filters.alphabet[1] !== 26));
    if (!choices.length) return undefined;
    const owners = { local: library.localSession(), server: library.serverSession() };
    const cached = new Set<string>();
    const capabilities = new Map<SourceId, Promise<boolean>>();
    const read = combinedTrackReader(choices, async (source, at, admitted) => {
      const owner = owners[source];
      const current = () =>
        admitted() &&
        owner === (source === "local" ? library.localSession() : library.serverSession());
      if (!current()) throw new Error(t("Chargement annulé."));
      const choice = choices.find((row) => row.source === source)!;
      if (choice.online) {
        try {
          if (restricted) {
            if (!capabilities.has(source))
              capabilities.set(
                source,
                requestAede<{ capabilities?: string[] }>(
                  "/api/v1/status",
                  {},
                  "GET",
                  null,
                  source,
                  owner,
                ).then((status) => status.capabilities?.includes("dynamic_browse_tracks") === true),
              );
            const supported = await capabilities.get(source);
            if (!current()) throw new Error(t("Chargement annulé."));
            if (!supported)
              throw new Error(t("Mettez à jour puis redémarrez Aède pour les filtres de pistes."));
            return await requestAede(
              "/api/me/v1/search",
              {
                expression: trackCollectionExpression(filters, reverse),
                offset: String(at),
                limit: "50",
              },
              "GET",
              null,
              source,
              owner,
            );
          }
          return await requestAede(
            "/api/v1/presentation/tracks",
            { offset: String(at), limit: "50", q: query },
            "GET",
            null,
            source,
            owner,
          );
        } catch (failure) {
          if (!current()) throw failure;
          if (!choice.snapshot?.tracks) throw failure;
        }
      }
      cached.add(source);
      if (!choice.snapshot?.tracks) return cachedTrackPage(choice.snapshot, query, at);
      return {
        ...trackBrowsePage(choice.snapshot.tracks, choice.snapshot.albums, filters, reverse, at),
        offset: at,
        limit: 50,
        scanned_at: choice.snapshot.scannedAt,
      };
    });
    return async (offset: number, size: number, current: () => boolean) => ({
      ...(await read(offset, size, current)),
      cached: [...cached],
    });
  });
  const read = createDiagnosticRead(
    () => (reader() ? { read: reader()!, offset: offset(), size: props.size } : false),
    (key, admission) => key.read(key.offset, key.size, admission.current),
  );
  const page = read.current;
  const histogram = createMemo(() => {
    const years = new Map<number, number>(),
      letters = new Map<number, number>();
    for (const choice of sources()) {
      const tracks = choice.snapshot?.tracks ?? [],
        albums = choice.snapshot?.albums ?? [];
      const dated = new Map(albums.map((album) => [album.reference, album.year]));
      for (const row of trackBrowseRows(tracks, albums, {
        ...props.filters,
        mode: ["alphabet", "both"].includes(props.filters.mode) ? "alphabet" : "none",
      })) {
        const year = dated.get(row.release ?? "");
        if (year !== null && year !== undefined) years.set(year, (years.get(year) ?? 0) + 1);
      }
      for (const row of trackBrowseRows(tracks, albums, {
        ...props.filters,
        mode: ["years", "both"].includes(props.filters.mode) ? "years" : "none",
      })) {
        const index = initialIndex(row.title);
        letters.set(index, (letters.get(index) ?? 0) + 1);
      }
    }
    return {
      years: [...years].map(([value, count]) => ({ value, count })),
      alphabet: [...letters].map(([value, count]) => ({ value, count })),
    };
  });
  return (
    <section class="page result-page tracks-page">
      <TracksHeader
        identity={refreshIdentity()}
        filters={
          <FilterBar
            yearDomain={props.yearDomain}
            value={props.filters}
            setValue={props.onFilters}
            context={t("Initiale de la piste · année de l’album")}
            histogram={histogram()}
            countLabel={t("pistes")}
            resultCount={page()?.total ?? 0}
            hasUnknownYear
          />
        }
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
      >
        <div class="catalog-actions">
          <button
            class="icon-button"
            type="button"
            aria-label={t("Inverser l’ordre des pistes")}
            title={t("Inverser l’ordre des pistes")}
            aria-pressed={props.reverse}
            onClick={props.onReverse}
          >
            <Icon name="sort" />
          </button>
          <SelectionCollection
            expression={trackCollectionExpression(props.filters, props.reverse)}
            disabled={!page()?.total}
          />
        </div>
      </TracksHeader>
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
                      identity={refreshIdentity()}
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
