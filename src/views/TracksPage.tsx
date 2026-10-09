import { pageSizes } from "../library/tool-preferences";
import { t } from "../i18n";
import { createMemo, createResource, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
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
  const reader = createMemo(() => {
    const sources = library.trackSources(),
      query = props.query;
    return sources.length
      ? combinedTrackReader(sources, (source, at) =>
          requestAede(
            "/api/v1/presentation/tracks",
            { offset: String(at), limit: "50", q: query },
            "GET",
            null,
            source,
          ),
        )
      : undefined;
  });
  const [page, { refetch }] = createResource(
    () => reader() && { read: reader()!, offset: offset(), size: props.size },
    (key) => key.read(key.offset, key.size),
  );
  return (
    <section class="page tracks-page">
      <label class="track-page-size">
        {t("Pistes par page")}{" "}
        <select
          value={props.size}
          onChange={(event) => props.setSize(Number(event.currentTarget.value))}
        >
          <For each={pageSizes}>{(size) => <option value={size}>{size}</option>}</For>
        </select>
      </label>
      <Show when={props.preferenceError}>
        <p role="alert">{props.preferenceError}</p>
      </Show>
      <Show when={!reader()}>
        <p class="notice">{t("Connectez Aède pour consulter toutes les pistes.")}</p>
      </Show>
      <Show when={page.error}>
        <p role="alert">
          {t("Pistes indisponibles :")} {String(page.error)}
        </p>
      </Show>
      <Show when={page.loading}>
        <p role="status">{t("Chargement des pistes…")}</p>
      </Show>
      <Show when={!page.loading && !page.error && page()}>
        {(value) => (
          <>
            <For each={value().unavailable}>
              {(issue) => (
                <p role="alert">
                  {sourceLabel(issue.source)} · {issue.error}{" "}
                  <button onClick={() => refetch()}>{t("Réessayer")}</button>
                </p>
              )}
            </For>
            <Show
              when={library
                .origins()
                .some((source) => !library.trackSources().some((row) => row.source === source))}
            >
              <p class="notice">
                {t(
                  "Les pistes de la bibliothèque déconnectée seront disponibles après reconnexion.",
                )}
              </p>
            </Show>
            <div class="section-heading">
              <p class="muted">
                {value().total} {t("piste")}
                {value().total > 1 ? "s" : ""} · {value().total ? offset() + 1 : 0}–
                {Math.min(offset() + props.size, value().total)}
              </p>
              <div class="page-controls">
                <button
                  disabled={!offset()}
                  onClick={() => setOffset(Math.max(0, offset() - props.size))}
                >
                  {t("Précédentes")}{" "}
                </button>
                <button
                  disabled={offset() + props.size >= value().total}
                  onClick={() => setOffset(offset() + props.size)}
                >
                  {t("Suivantes")}{" "}
                </button>
              </div>
            </div>
            <Show when={!value().items.length}>
              <p class="empty">{t("Aucune piste dans cette recherche.")}</p>
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
    </section>
  );
}
