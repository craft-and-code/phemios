import { AlbumIntegrity } from "../components/AlbumIntegrity";
import { Feedback } from "../components/Feedback";
import { PageLoader } from "../components/PageLoader";
import { AlbumMetadata } from "../components/AlbumMetadata";
import { Icon } from "../components/Icon";
import { SourceBadge } from "../components/SourceBadge";
import { t } from "../i18n";
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
export function AlbumPage(props: {
  album: Album;
  onYear: (year: number) => void;
  onGenres: (genres: readonly string[]) => void;
  onCountry: (country: string) => void;
}) {
  const library = useLibrary();
  const [enlarged, setEnlarged] = createSignal(false);
  const [m3uStatus, setM3uStatus] = createSignal({ message: "", failed: false });
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
        <div class="detail-cover-actions">
          <button
            class="cover-open"
            aria-label={t("Agrandir la pochette de {0}", props.album.title)}
            disabled={!library.demo && !library.image(props.album.reference, "cover")}
            onClick={(event) => {
              event.currentTarget.focus();
              setEnlarged(true);
            }}
          >
            <Artwork album={props.album} />
          </button>
        </div>
        <Show when={enlarged()}>
          <CoverPreview album={props.album} onClose={() => setEnlarged(false)} />
        </Show>
        <div class="detail-hero-text">
          <p class="eyebrow">{props.album.compilation ? "COMPILATION" : "ALBUM"}</p>
          <div class="detail-title">
            <h1>{props.album.title}</h1>
            <SourceBadge reference={props.album.reference} />
          </div>
          <p>
            <Show when={artist()} fallback={t("Artistes divers")}>
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
            <Show when={props.album.year !== null} fallback={t("Année inconnue")}>
              <button
                class="metadata-link"
                aria-label={t("Voir les albums de {0}", props.album.year)}
                onClick={() => props.onYear(props.album.year!)}
              >
                {props.album.year}
              </button>
            </Show>
          </p>
          <AlbumMetadata
            album={props.album}
            artist={artist()}
            onGenres={props.onGenres}
            onCountry={props.onCountry}
          />
          <button
            class="icon-button detail-play"
            aria-label={t("Lire l’album")}
            title={t("Lire l’album")}
            disabled={
              !library.sessionFor(props.album.reference) ||
              library.sessionFor(props.album.reference)?.account.role === "auditor" ||
              library.player.busy()
            }
            onClick={() => void library.player.startReference(props.album.reference)}
          >
            <Icon name="play" />
          </button>
        </div>
      </div>
      <AnnotationPanel reference={props.album.reference} kind="album" />
      <section>
        <div class="section-heading">
          <h2>{t("Pistes")}</h2>
          <M3UExport
            release={props.album.reference}
            title={props.album.title}
            onStatus={(message, failed) => setM3uStatus({ message, failed })}
          />
        </div>
        <Feedback
          message={m3uStatus().message}
          error={m3uStatus().failed}
          onClose={() => setM3uStatus({ message: "", failed: false })}
        />
        <Show when={tracks.error}>
          <p role="alert">
            {t("Pistes indisponibles :")} {String(tracks.error)}
          </p>
        </Show>
        <Show when={tracks.loading}>
          <PageLoader inline label={t("Chargement des pistes…")} />
        </Show>
        <Show when={!library.sessionFor(props.album.reference)}>
          <p class="muted">{t("Connectez Aède pour consulter les pistes.")}</p>
        </Show>
        <Show when={tracks() && !tracks.loading && !tracks()?.length}>
          <p class="muted">{t("Aucune piste dans cet album.")}</p>
        </Show>
        <For each={discs()}>
          {(disc) => (
            <section class="album-disc">
              <Show when={discs().length > 1}>
                <h3>{disc.disc === null ? t("Disque non renseigné") : `CD ${disc.disc}`}</h3>
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
                          artist()?.name ?? t("Artistes divers"),
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
          <h2>{t("Analyse de l’album")}</h2>
          <div class="detail-export-actions">
            <AnalysisDownload
              reference={props.album.reference}
              album
              available={!!tracks()?.length && tracks()!.every((track) => track.analysis_available)}
            />
          </div>
        </div>
        <AlbumIntegrity release={props.album.reference} />
        <JobControls release={props.album.reference} />
      </section>
    </article>
  );
}
