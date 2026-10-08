import { createEffect, createResource, createSignal, For, Show, on } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseTrackPage } from "../library/track-page";
import { TrackResults } from "../components/TrackResults";
/** All catalog placements, including albumless tracks, use bounded server search pages. */
export function TracksPage(props: { query: string }) {
  const library = useLibrary(),
    [offset, setOffset] = createSignal(0);
  createEffect(
    on(
      () => [props.query, library.session()],
      () => setOffset(0),
    ),
  );
  const [page] = createResource(
    () =>
      library.session()
        ? { session: library.session(), query: props.query, offset: offset() }
        : false,
    async (key) => {
      const epoch = library.snapshot()?.scannedAt;
      const result = parseTrackPage(
        await requestAede("/api/v1/presentation/tracks", {
          offset: String(key.offset),
          limit: "50",
          q: key.query,
        }),
        key.offset,
      );
      if (epoch !== undefined && result.scannedAt !== epoch)
        throw new Error("Le catalogue a changé ; resynchronisez la bibliothèque.");
      return result;
    },
  );
  return (
    <section class="page tracks-page">
      <Show when={!library.session()}>
        <p class="notice">Connectez Aède pour consulter toutes les pistes.</p>
      </Show>
      <Show when={page.error}>
        <p role="alert">Pistes indisponibles : {String(page.error)}</p>
      </Show>
      <Show when={page.loading}>
        <p role="status">Chargement des pistes…</p>
      </Show>
      <Show when={!page.loading && !page.error && page()}>
        {(value) => (
          <>
            <div class="section-heading">
              <p class="muted">
                {value().total} pistes · {value().total ? offset() + 1 : 0}–
                {Math.min(offset() + 50, value().total)}
              </p>
              <div class="page-controls">
                <button disabled={!offset()} onClick={() => setOffset(Math.max(0, offset() - 50))}>
                  Précédentes
                </button>
                <button
                  disabled={offset() + 50 >= value().total}
                  onClick={() => setOffset(offset() + 50)}
                >
                  Suivantes
                </button>
              </div>
            </div>
            <Show when={!value().items.length}>
              <p class="empty">Aucune piste dans cette recherche.</p>
            </Show>
            <ol class="track-list">
              <For each={value().items}>
                {(track, index) => (
                  <>
                    <TrackResults
                      track={track}
                      number={offset() + index() + 1}
                      onPlay={() => void library.player.startReference(track.reference)}
                      context={
                        <>
                          <Show when={track.release} fallback="Sans album">
                            {(reference) => (
                              <a href={`#/album/${encodeURIComponent(reference())}`}>
                                {track.album_title}
                              </a>
                            )}
                          </Show>
                          <Show when={track.disc_no}> · CD {track.disc_no}</Show>
                          <Show when={track.track_no}> · Piste {track.track_no}</Show>
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
