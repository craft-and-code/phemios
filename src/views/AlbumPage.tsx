import { createCatalogDetail } from "../library/catalog-detail";
import { TrackDurationTotal } from "../components/TrackDurationTotal";
import { Icon } from "../components/Icon";
import { QueueLyrics } from "../components/QueueLyrics";
import { createAlbumIntegrity, integrityPath } from "../library/album-integrity";
import { CoverPlay } from "../components/CoverPlay";
import { AlbumIntegrity } from "../components/AlbumIntegrity";
import { Feedback } from "../components/Feedback";
import { PageLoader } from "../components/PageLoader";
import { AlbumMetadata } from "../components/AlbumMetadata";
import { SourceBadge } from "../components/SourceBadge";
import { t } from "../i18n";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
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
  const trackRead = createCatalogDetail(
    () => props.album.reference,
    () => library.sessionFor(props.album.reference),
    (reference, owner, admission) => albumTracks(reference, { owner, current: admission.current }),
  );
  const tracks = trackRead.current;
  const [lyricFeedbackHost, setLyricFeedbackHost] = createSignal<HTMLElement>();
  const lyrics = library.albumLyrics;
  createEffect(() => {
    const rows = tracks();
    if (rows) lyrics.select(props.album.reference, rows);
  });
  const integrity = createAlbumIntegrity({
    release: () => props.album.reference,
    session: () => library.sessionFor(props.album.reference),
    paths: () => (tracks() ?? []).map((track) => integrityPath(track.reference) ?? ""),
    jobs: library.tasks.jobs,
    start: (release) => library.tasks.start("check", release, true),
    cancel: (id, source) => library.tasks.cancel(id, source),
  });
  const discs = createMemo(() => discGroups(tracks() ?? []));
  const completed = () => library.tasks.jobs().filter((job) => job.status === "completed").length;
  let lastCompleted = completed();
  createEffect(() => {
    const count = completed();
    if (count > lastCompleted) {
      lastCompleted = count;
      void trackRead.refetch();
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
          <CoverPlay
            detail
            append="badge"
            reference={props.album.reference}
            title={props.album.title}
            label={t("Lire l’album")}
          />
        </div>
      </div>
      <AnnotationPanel reference={props.album.reference} kind="album" />
      <section>
        <div class="section-heading">
          <div class="album-track-summary">
            <h2>{t("Pistes")}</h2>
            <TrackDurationTotal
              tracks={trackRead.loading() || trackRead.error() ? undefined : tracks()}
            />
          </div>
          <div class="detail-export-actions">
            <AlbumIntegrity
              busy={integrity.busy()}
              cancellable={integrity.canCancel()}
              enabled={integrity.enabled() && !trackRead.loading() && !trackRead.error()}
              onStart={() => void integrity.start()}
              onCancel={() => void integrity.cancel()}
            />
            <Show
              when={lyrics.target() === props.album.reference}
              fallback={
                <button
                  class="icon-button quiet"
                  disabled
                  title={
                    lyrics.controller.busy()
                      ? t("Un téléchargement de paroles d’album est déjà en cours.")
                      : t("Télécharger les paroles de l’album")
                  }
                  aria-label={t("Télécharger les paroles de l’album")}
                >
                  <Icon name="lyrics-download" />
                </button>
              }
            >
              <QueueLyrics
                controller={lyrics.controller}
                tracks={tracks() ?? []}
                feedbackHost={lyricFeedbackHost}
                label={t("Télécharger les paroles de l’album")}
              />
            </Show>
            <M3UExport
              release={props.album.reference}
              title={props.album.title}
              onStatus={(message, failed) => setM3uStatus({ message, failed })}
            />
          </div>
        </div>
        <Feedback error persistent message={integrity.error()} />
        <div ref={setLyricFeedbackHost} class="album-lyrics-feedback" />
        <Feedback
          message={m3uStatus().message}
          error={m3uStatus().failed}
          onClose={() => setM3uStatus({ message: "", failed: false })}
        />
        <Show when={trackRead.error()}>
          <p role="alert">
            {t("Pistes indisponibles :")} {String(trackRead.error())}
          </p>
        </Show>
        <Show when={trackRead.loading()}>
          <PageLoader inline label={t("Chargement des pistes…")} />
        </Show>
        <Show when={!library.sessionFor(props.album.reference)}>
          <p class="muted">{t("Connectez Aède pour consulter les pistes.")}</p>
        </Show>
        <Show when={tracks() && !trackRead.loading() && !tracks()?.length}>
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
                      integrity={integrity.result(integrityPath(row.track.reference))}
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
        <JobControls
          release={props.album.reference}
          coverage={
            tracks()
              ? {
                  tracks: tracks()!.length,
                  current: tracks()!.filter((track) => track.analysis_available).length,
                  spectra: tracks()!.filter((track) => track.spectrum_available).length,
                }
              : undefined
          }
        />
      </section>
    </article>
  );
}
