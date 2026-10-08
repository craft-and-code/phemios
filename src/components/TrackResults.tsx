import { createSignal, createUniqueId, For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import type { Track } from "../library/server";
import { AnalysisCharts } from "./AnalysisCharts";
import { AnalysisDownload } from "./AnalysisDownload";
import { Icon } from "./Icon";
/** Compact actions open retained analysis or explicitly fetched spectra independently. */
export function TrackResults(props: {
  track: Track & { spectrum_available: boolean };
  number: number;
  onPlay: () => void;
}) {
  const library = useLibrary(),
    id = createUniqueId(),
    [analysis, setAnalysis] = createSignal(false),
    [spectrum, setSpectrum] = createSignal(false);
  const duration = () => props.track.duration_ms;
  return (
    <li>
      <div class="track-heading">
        <span class="track-number">{props.number}.</span>
        <strong>{props.track.title}</strong>
        <small>
          {duration() === null
            ? "Durée inconnue"
            : `${Math.floor(duration()! / 60000)}:${String(Math.floor(duration()! / 1000) % 60).padStart(2, "0")}`}
        </small>
        <div class="track-actions">
          <button
            class="icon-button quiet"
            disabled={!library.player.ready() || library.player.busy()}
            aria-label={`Lire ${props.track.title}`}
            onClick={props.onPlay}
          >
            <Icon name="play" />
          </button>
          <Show when={props.track.analyses.length}>
            <button
              class="icon-button quiet"
              title="Afficher ou masquer l’analyse FlacCompagnon"
              aria-label={`Analyse FlacCompagnon de ${props.track.title}`}
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
              title="Afficher ou masquer le spectre"
              aria-label={`Spectre de ${props.track.title}`}
              aria-expanded={spectrum()}
              aria-controls={`${id}-spectrum`}
              aria-pressed={spectrum()}
              onClick={() => {
                const visible = !spectrum();
                setSpectrum(visible);
                if (visible) void library.warmImage(props.track.reference, "spectrum");
              }}
            >
              <Icon name="spectrum" />
            </button>
          </Show>
        </div>
      </div>
      <Show when={analysis()}>
        <div id={`${id}-analysis`} class="track-analysis">
          <div class="analysis-result-heading">
            <strong>Analyse FlacCompagnon</strong>
            <AnalysisDownload
              reference={props.track.reference}
              available={props.track.analyses.length > 0}
            />
          </div>
          <For each={props.track.analyses}>{(value) => <AnalysisCharts analysis={value} />}</For>
        </div>
      </Show>
      <Show when={spectrum()}>
        <div id={`${id}-spectrum`}>
          <Show
            when={library.image(props.track.reference, "spectrum")}
            fallback={
              <Show when={!library.imageError(props.track.reference, "spectrum")}>
                <p class="muted" role="status">
                  Chargement du spectre…
                </p>
              </Show>
            }
          >
            {(url) => <img class="spectrum" src={url()} alt={`Spectre de ${props.track.title}`} />}
          </Show>
          <Show when={library.imageError(props.track.reference, "spectrum")}>
            <p role="alert">{library.imageError(props.track.reference, "spectrum")}</p>
          </Show>
        </div>
      </Show>
    </li>
  );
}
