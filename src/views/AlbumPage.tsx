import { AnnotationPanel } from "../components/AnnotationPanel";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { TrackResults } from "../components/TrackResults";
import { AnalysisDownload } from "../components/AnalysisDownload";
import { CoverPreview } from "../components/CoverPreview";
import { Artwork } from "../components/Artwork";
import { JobControls } from "../components/JobControls";
import { M3UExport } from "../components/M3UExport";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import type { Track } from "../library/server";
import type { Album } from "../library/types";
interface AvailableTrack extends Track {
  spectrum_available: boolean;
}
/** Read/edit current-account annotations; save failure never discards the draft. */
export function AlbumPage(props: { album: Album }) {
  const library = useLibrary();
  const [enlarged, setEnlarged] = createSignal(false);
  const artist = () => library.artists().find((item) => item.reference === props.album.artist);
  const [tracks, { refetch }] = createResource(
    () => (library.session() ? props.album.reference : false),
    async (ref) => {
      const album = await requestAede<{ tracks: string[] }>("/api/v1/album", { ref });
      const rows: AvailableTrack[] = [];
      for (const ref of album.tracks)
        rows.push(await requestAede<AvailableTrack>("/api/v1/track", { ref }));
      return rows;
    },
  );
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
            {artist()?.name ?? "Artistes divers"} · {props.album.year ?? "Année inconnue"}
          </p>
          <button class="primary" disabled>
            Lecture native à raccorder
          </button>
          <M3UExport release={props.album.reference} title={props.album.title} />
        </div>
      </div>
      <AnnotationPanel reference={props.album.reference} kind="album" />
      <section>
        <h2>Pistes</h2>
        <Show when={tracks.error}>
          <p role="alert">Pistes indisponibles : {String(tracks.error)}</p>
        </Show>
        <Show when={tracks.loading}>
          <p class="muted">Chargement des pistes…</p>
        </Show>
        <ol class="track-list">
          <For each={tracks()}>
            {(track, index) => <TrackResults track={track} number={index() + 1} />}
          </For>
        </ol>
      </section>
      <section class="album-analysis-jobs">
        <div class="section-heading">
          <h2>Analyse de l’album</h2>
          <AnalysisDownload
            reference={props.album.reference}
            album
            available={!!tracks()?.length && tracks()!.every((track) => track.analyses.length > 0)}
          />
        </div>
        <JobControls release={props.album.reference} />
      </section>
    </article>
  );
}
