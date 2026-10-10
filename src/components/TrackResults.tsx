import { t } from "../i18n";
import type { JSX } from "solid-js";
import { createEffect, createResource, createSignal, createUniqueId, For, Show } from "solid-js";
import { PlayingBars } from "./PlayingBars";
import { SpectrumDownload } from "./SpectrumDownload";
import { requestAede } from "../platform/desktop";
import { useLibrary } from "../library/context";
import type { Track } from "../library/server";
import { AnalysisCharts } from "./AnalysisCharts";
import { AnalysisDownload } from "./AnalysisDownload";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";
/** Compact actions open retained analysis or explicitly fetched spectra independently. */
export function TrackResults(props: {
  track: Track & { spectrum_available: boolean };
  number: number;
  onPlay: () => void;
  context?: JSX.Element;
  expanded?: boolean;
  origin?: boolean;
}) {
  const library = useLibrary(),
    id = createUniqueId(),
    [analysis, setAnalysis] = createSignal(
      !!props.expanded && (props.track.analysis_available ?? props.track.analyses.length > 0),
    ),
    [spectrum, setSpectrum] = createSignal(!!props.expanded && props.track.spectrum_available);
  createEffect(() => {
    if (spectrum()) void library.warmImage(props.track.reference, "spectrum");
  });
  const duration = () => props.track.duration_ms;
  const [detail] = createResource(
    () =>
      analysis() && library.sessionFor(props.track.reference) && !props.track.analyses.length
        ? props.track.reference
        : false,
    async (reference) => {
      const row = await requestAede<Track>("/api/v1/track", { ref: reference });
      if (row.reference !== reference || !Array.isArray(row.analyses))
        throw new Error(t("Analyse de piste Aède invalide."));
      return row;
    },
  );
  const values = () =>
    props.track.analyses.length ? props.track.analyses : (detail()?.analyses ?? []);
  return (
    <li class="track-row">
      <div class="track-main-row">
        <div class="track-heading">
          <span class="track-number">{props.number}.</span>
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
            <button
              class="icon-button quiet"
              disabled={
                !library.sessionFor(props.track.reference) ||
                library.sessionFor(props.track.reference)?.account.role === "auditor" ||
                library.player.busy()
              }
              aria-label={t("Lire {0}", props.track.title)}
              onClick={props.onPlay}
            >
              <Icon name="play" />
            </button>
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
          </div>
        </div>
        <Show when={props.context}>
          <div class="track-context">{props.context}</div>
        </Show>
      </div>
      <Show when={analysis()}>
        <div id={`${id}-analysis`} class="track-analysis">
          <div class="analysis-result-heading">
            <strong>{t("Analyse FlacCompagnon")}</strong>
            <AnalysisDownload
              reference={props.track.reference}
              available={values().length > 0 && !detail.loading}
            />
          </div>
          <Show when={detail.loading}>
            <p role="status">{t("Chargement de l’analyse…")}</p>
          </Show>
          <Show when={detail.error}>
            <p role="alert">
              {t("Analyse indisponible :")} {String(detail.error)}
            </p>
          </Show>
          <Show when={!detail.loading && !detail.error && !values().length}>
            <p class="muted">{t("Aucune analyse conservée pour ce titre.")}</p>
          </Show>
          <For each={values()}>{(value) => <AnalysisCharts analysis={value} />}</For>
        </div>
      </Show>
      <Show when={spectrum()}>
        <div id={`${id}-spectrum`} class="track-analysis">
          <div class="analysis-result-heading">
            <strong>{t("Spectre")}</strong>
            <SpectrumDownload reference={props.track.reference} />
          </div>
          <Show
            when={library.image(props.track.reference, "spectrum")}
            fallback={
              <Show when={!library.imageError(props.track.reference, "spectrum")}>
                <p class="muted" role="status">
                  {t("Chargement du spectre…")}{" "}
                </p>
              </Show>
            }
          >
            {(url) => (
              <img class="spectrum" src={url()} alt={t("Spectre de {0}", props.track.title)} />
            )}
          </Show>
          <Show when={library.imageError(props.track.reference, "spectrum")}>
            <p role="alert">{library.imageError(props.track.reference, "spectrum")}</p>
          </Show>
        </div>
      </Show>
    </li>
  );
}
