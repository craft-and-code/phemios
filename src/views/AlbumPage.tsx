import { AnnotationPanel } from "../components/AnnotationPanel";
import { createEffect, createResource, For, Show } from "solid-js";
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
        <Artwork album={props.album} />
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
      <AnnotationPanel reference={props.album.reference} />
      <section>
        <h2>Pistes, analyses et spectres</h2>
        <JobControls release={props.album.reference} />
        <Show when={tracks.error}>
          <p role="alert">Pistes indisponibles : {String(tracks.error)}</p>
        </Show>
        <Show when={tracks.loading}>
          <p class="muted">Chargement des pistes…</p>
        </Show>
        <ol class="track-list">
          <For each={tracks()}>
            {(track) => (
              <li>
                <div class="track-heading">
                  <strong>{track.title}</strong>
                  <small>
                    {track.duration_ms === null
                      ? "Durée inconnue"
                      : `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor(track.duration_ms / 1000) % 60).padStart(2, "0")}`}
                  </small>
                  <Show when={track.spectrum_available}>
                    <button onClick={() => library.warmImage(track.reference, "spectrum")}>
                      Afficher le spectre
                    </button>
                  </Show>
                </div>
                <Show when={track.analyses.length}>
                  <details>
                    <summary>Analyse FlacCompagnon disponible</summary>
                    <pre>{JSON.stringify(track.analyses, null, 2)}</pre>
                  </details>
                </Show>
                <Show when={library.image(track.reference, "spectrum")}>
                  {(url) => <img class="spectrum" src={url()} alt={`Spectre de ${track.title}`} />}
                </Show>
                <Show when={library.imageError(track.reference, "spectrum")}>
                  <p role="alert">{library.imageError(track.reference, "spectrum")}</p>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </section>
    </article>
  );
}
