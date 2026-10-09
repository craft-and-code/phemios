import { AnnotationPanel } from "../components/AnnotationPanel";
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import { TrackResults } from "../components/TrackResults";
import { AnalysisDownload } from "../components/AnalysisDownload";
import { CoverPreview } from "../components/CoverPreview";
import { Artwork } from "../components/Artwork";
import { JobControls } from "../components/JobControls";
import { M3UExport } from "../components/M3UExport";
import { useLibrary } from "../library/context";
import { albumTracks, discGroups } from "../library/album-tracks";
import type { Album } from "../library/types";
/** Read/edit current-account annotations; save failure never discards the draft. */
export function AlbumPage(props: { album: Album; onYear: (year: number) => void }) {
  const library = useLibrary();
  const [enlarged, setEnlarged] = createSignal(false);
  const artist = () => library.artists().find((item) => item.reference === props.album.artist);
  const [tracks, { refetch }] = createResource(
    () => (library.sessionFor(props.album.reference) ? props.album.reference : false),
    albumTracks,
  );
  const discs = createMemo(() => discGroups(tracks() ?? []));
  const completed = () => library.tasks.jobs().filter((job) => job.status === "completed").length;
  let lastCompleted = completed();
  createEffect(() => {
    const count = completed();
    if (count > lastCompleted) {
      lastCompleted = count;
      void refetch();
    }
  });
  return (
    <article class="page album-page">
      <div class="album-hero">
        <button
          class="cover-open"
          aria-label={`Agrandir la pochette de ${props.album.title}`}
          disabled={!library.demo && !library.image(props.album.reference, "cover")}
          onClick={(event) => {
            event.currentTarget.focus();
            setEnlarged(true);
          }}
        >
          <Artwork album={props.album} />
        </button>
        <Show when={enlarged()}>
          <CoverPreview album={props.album} onClose={() => setEnlarged(false)} />
        </Show>
        <div>
          <p class="eyebrow">{props.album.compilation ? "COMPILATION" : "ALBUM"}</p>
          <h1>{props.album.title}</h1>
          <p>
            <Show when={artist()} fallback="Artistes divers">
              {(row) => (
                <a
                  class="album-artist-link"
                  href={`#/artist/${encodeURIComponent(row().reference)}`}
                >
                  {row().name}
                </a>
              )}
            </Show>{" "}
            ·{" "}
            <Show when={props.album.year !== null} fallback="Année inconnue">
              <button
                class="metadata-link"
                aria-label={`Voir les albums de ${props.album.year}`}
                onClick={() => props.onYear(props.album.year!)}
              >
                {props.album.year}
              </button>
            </Show>
          </p>
        </div>
      </div>
      <AnnotationPanel reference={props.album.reference} kind="album" />
      <section>
        <div class="section-heading">
          <h2>Pistes</h2>
          <M3UExport release={props.album.reference} title={props.album.title} />
        </div>
        <Show when={tracks.error}>
          <p role="alert">Pistes indisponibles : {String(tracks.error)}</p>
        </Show>
        <Show when={tracks.loading}>
          <p class="muted">Chargement des pistes…</p>
        </Show>
        <Show when={!library.sessionFor(props.album.reference)}>
          <p class="muted">Connectez Aède pour consulter les pistes.</p>
        </Show>
        <Show when={tracks() && !tracks.loading && !tracks()?.length}>
          <p class="muted">Aucune piste dans cet album.</p>
        </Show>
        <For each={discs()}>
          {(disc) => (
            <section class="album-disc">
              <Show when={discs().length > 1}>
                <h3>{disc.disc === null ? "Disque non renseigné" : `CD ${disc.disc}`}</h3>
              </Show>
              <ol class="track-list">
                <For each={disc.tracks}>
                  {(row) => (
                    <TrackResults
                      track={row.track}
                      number={row.number}
                      onPlay={() =>
                        void library.player.start(
                          tracks() ?? [],
                          props.album,
                          artist()?.name ?? "Artistes divers",
                          row.index,
                        )
                      }
                    />
                  )}
                </For>
              </ol>
            </section>
          )}
        </For>
      </section>
      <section class="album-analysis-jobs">
        <div class="section-heading">
          <h2>Analyse de l’album</h2>
          <AnalysisDownload
            reference={props.album.reference}
            album
            available={!!tracks()?.length && tracks()!.every((track) => track.analysis_available)}
          />
        </div>
        <JobControls release={props.album.reference} />
      </section>
    </article>
  );
}
