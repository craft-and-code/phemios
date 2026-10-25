import { TrackResultPanel } from "./TrackResultPanel";
import { Feedback } from "./Feedback";
import { createCatalogDetail } from "../library/catalog-detail";
import { referenceSource } from "../library/sources";
import { LyricsIcon } from "./LyricsIcon";
import { CoverPlay } from "./CoverPlay";
import { createIntegrityDisclosure, type IntegrityResult } from "../library/album-integrity";
import { TrackIntegrityError } from "./TrackIntegrityError";
import { TrackIntegrity } from "./TrackIntegrity";
import { PageLoader } from "./PageLoader";
import { LyricsText } from "./LyricsText";
import { createTrackLyrics } from "../library/track-lyrics";
import { LyricsDownload } from "./LyricsDownload";
import { t } from "../i18n";
import type { JSX } from "solid-js";
import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import { PlayingBars } from "./PlayingBars";
import { SpectrumDownload } from "./SpectrumDownload";
import { requestAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
import type { Track } from "../library/server";
import { SavedAnalysisCharts as AnalysisCharts } from "./SavedAnalysisCharts";
import { AnalysisDownload } from "./AnalysisDownload";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** Compact actions independently open retained analyses, spectra and existing lyrics. */
export function TrackResults(props: {
  track: Track & { spectrum_available: boolean };
  number: number;
  onPlay: () => void;
  context?: JSX.Element;
  expanded?: boolean;
  origin?: boolean;
  integrity?: IntegrityResult | undefined;
}) {
  const library = useLibrary(),
    id = createUniqueId(),
    [analysis, setAnalysis] = createSignal(
      !!props.expanded && (props.track.analysis_available ?? props.track.analyses.length > 0),
    ),
    [spectrum, setSpectrum] = createSignal(!!props.expanded && props.track.spectrum_available);
  const [downloadStatus, setDownloadStatus] = createSignal(""),
    [downloadFailed, setDownloadFailed] = createSignal(false);
  createEffect(() => {
    void props.track.reference;
    void library.sessionFor(props.track.reference);
    setDownloadStatus("");
  });
  createEffect(() => {
    if (spectrum()) void library.warmImage(props.track.reference, "spectrum");
  });
  const words = createTrackLyrics({
    reference: () => props.track.reference,
    available: () => props.track.lyrics_available,
    session: () => library.sessionFor(props.track.reference),
    jobs: library.tasks.jobs,
    detail: !!props.expanded,
  });
  const integrityDetails = createIntegrityDisclosure(() => props.integrity);
  const closeIntegrity = () => {
    integrityDetails.close();
    document.getElementById(`${id}-integrity-toggle`)?.focus();
  };
  const duration = () => props.track.duration_ms;
  const detailRead = createCatalogDetail(
    () => (analysis() && !props.track.analyses.length ? props.track.reference : false),
    () => library.sessionFor(props.track.reference),
    async (reference, owner) => {
      const row = await requestAede<Track>(
        "/api/v1/track",
        { ref: reference },
        "GET",
        null,
        referenceSource(reference),
        owner,
      );
      if (row.reference !== reference || !Array.isArray(row.analyses))
        throw new Error(t("Analyse de piste Aède invalide."));
      return row;
    },
  );
  const detail = detailRead.current;
  const values = () =>
    props.track.analyses.length ? props.track.analyses : (detail()?.analyses ?? []);
  return (
    <li class="track-row">
      <div class="track-main-row">
        <div class="track-heading">
          <span class="track-number">{props.number}.</span>
          <TrackIntegrity
            result={props.integrity}
            id={`${id}-integrity-toggle`}
            controls={`${id}-integrity-detail`}
            expanded={integrityDetails.open()}
            onToggle={integrityDetails.toggle}
          />
          <PlayingBars reference={props.track.reference} />
          <a class="track-title" href={`#/track/${encodeURIComponent(props.track.reference)}`}>
            {props.track.title}
          </a>
          <Show when={props.origin}>
            <SourceBadge reference={props.track.reference} />
          </Show>
          <small>
            {duration() === null
              ? t("Durée inconnue")
              : `${Math.floor(duration()! / 60000)}:${String(Math.floor(duration()! / 1000) % 60).padStart(2, "0")}`}
          </small>
          <div class="track-actions">
            <Show when={props.track.analysis_available ?? props.track.analyses.length > 0}>
              <button
                class="icon-button quiet"
                title={t("Afficher ou masquer l’analyse FlacCompagnon")}
                aria-label={t("Analyse FlacCompagnon de {0}", props.track.title)}
                aria-expanded={analysis()}
                aria-controls={`${id}-analysis`}
                aria-pressed={analysis()}
                onClick={() => setAnalysis(!analysis())}
              >
                <Icon name="wave" />
              </button>
            </Show>
            <Show when={props.track.spectrum_available}>
              <button
                class="icon-button quiet"
                title={t("Afficher ou masquer le spectre")}
                aria-label={t("Spectre de {0}", props.track.title)}
                aria-expanded={spectrum()}
                aria-controls={`${id}-spectrum`}
                aria-pressed={spectrum()}
                onClick={() => {
                  const visible = !spectrum();
                  setSpectrum(visible);
                }}
              >
                <Icon name="spectrum" />
              </button>
            </Show>
            <Show
              when={words.available() || words.visible()}
              fallback={<LyricsDownload reference={props.track.reference} />}
            >
              <button
                class="icon-button quiet"
                title={`${t("Afficher ou masquer les paroles")} · ${words.lyrics()?.synced === true ? t("Paroles synchronisées") : words.lyrics()?.synced === false ? t("Paroles non synchronisées") : t("Synchronisation à vérifier")}`}
                aria-label={t("Paroles de {0}", props.track.title)}
                disabled={!library.sessionFor(props.track.reference) && !words.visible()}
                aria-expanded={words.visible()}
                aria-controls={`${id}-lyrics`}
                aria-pressed={words.visible()}
                onClick={words.toggle}
              >
                <LyricsIcon synced={words.lyrics()?.synced} />
              </button>
            </Show>
            <CoverPlay
              reference={props.track.reference}
              title={props.track.title}
              class="quiet track-play"
              append
              onPlay={props.onPlay}
            />
          </div>
        </div>
        <Show when={props.context}>
          <div class="track-context">{props.context}</div>
        </Show>
      </div>
      <Show when={integrityDetails.open()}>
        <TrackIntegrityError
          id={`${id}-integrity-detail`}
          result={props.integrity}
          onClose={closeIntegrity}
        />
      </Show>
      <Show when={analysis()}>
        <TrackResultPanel id={`${id}-analysis`} label={t("Analyse FlacCompagnon")}>
          <Show when={detailRead.loading()}>
            <PageLoader inline label={t("Chargement de l’analyse…")} />
          </Show>
          <Show when={detailRead.error()}>
            <Feedback error persistent message={String(detailRead.error())} />
          </Show>
          <Show when={!detailRead.loading() && !detailRead.error() && !values().length}>
            <p class="muted">{t("Aucune analyse conservée pour ce titre.")}</p>
          </Show>
          <For each={values()}>
            {(value) => (
              <AnalysisCharts
                analysis={value}
                actions={
                  <AnalysisDownload
                    reference={props.track.reference}
                    available={values().length > 0 && !detailRead.loading()}
                    onStatus={(message, failure) => {
                      setDownloadStatus(message);
                      setDownloadFailed(failure);
                    }}
                  />
                }
              />
            )}
          </For>
          <Feedback
            message={downloadStatus()}
            error={downloadFailed()}
            onClose={() => setDownloadStatus("")}
          />
        </TrackResultPanel>
      </Show>
      <Show when={spectrum()}>
        <TrackResultPanel
          id={`${id}-spectrum`}
          title={t("Spectre")}
          framed
          actions={<SpectrumDownload reference={props.track.reference} />}
        >
          <Show
            when={library.image(props.track.reference, "spectrum")}
            fallback={
              <Show when={!library.imageError(props.track.reference, "spectrum")}>
                <PageLoader inline label={t("Chargement du spectre…")} />
              </Show>
            }
          >
            {(url) => (
              <img class="spectrum" src={url()} alt={t("Spectre de {0}", props.track.title)} />
            )}
          </Show>
          <Show when={library.imageError(props.track.reference, "spectrum")}>
            <Feedback
              error
              persistent
              message={library.imageError(props.track.reference, "spectrum") ?? ""}
            />
          </Show>
        </TrackResultPanel>
      </Show>
      <Show when={words.visible()}>
        <section id={`${id}-lyrics`} class="track-analysis track-lyrics">
          <div class="analysis-result-heading">
            <strong>{t("Paroles")}</strong>
            <button
              class="icon-button quiet"
              aria-label={t("Actualiser les paroles")}
              title={t("Actualiser les paroles")}
              disabled={words.loading()}
              onClick={words.refresh}
            >
              <Show when={words.loading()} fallback={<Icon name="refresh" />}>
                <span class="spinner" />
              </Show>
            </button>
          </div>
          <Show when={words.loading()}>
            <PageLoader inline label={t("Chargement des paroles…")} />
          </Show>
          <Show when={words.error()}>
            <Feedback error persistent message={words.error()} />
          </Show>
          <Show when={!words.loading() && !words.error()}>
            <Show
              when={words.lyrics()}
              fallback={<p class="muted">{t("Aucune parole disponible.")}</p>}
            >
              {(lyrics) => <LyricsText lyrics={lyrics()} reference={props.track.reference} />}
            </Show>
          </Show>
        </section>
      </Show>
    </li>
  );
}
