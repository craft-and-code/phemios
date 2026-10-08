import { createMemo, For, Show } from "solid-js";
import { analysisReading, measurementHelp } from "../library/analysis-reading";
import { analysisGraphs } from "../library/analysis-graphs";
const format = (value: number) =>
  new Intl.NumberFormat("fr", { maximumFractionDigits: 2 }).format(value);
/** SVG scales show measured summaries and retained event positions, not invented waveforms. */
export function AnalysisCharts(props: { analysis: unknown }) {
  const result = createMemo(() => {
    try {
      return { data: analysisGraphs(props.analysis) };
    } catch (error) {
      return { error: String(error) };
    }
  });
  return (
    <Show
      when={result().data}
      fallback={<p role="alert">Graphiques indisponibles : {result().error}</p>}
    >
      {(data) => (
        <div class="analysis-charts" classList={{ stale: data().stale === true }}>
          <div class="analysis-reading">
            <For each={analysisReading(data())}>
              {(reading) => (
                <section class={`analysis-reading-card ${reading.tone}`}>
                  <strong>{reading.label}</strong>
                  <p>{reading.detail}</p>
                </section>
              )}
            </For>
          </div>
          <p class="analysis-verdict">FlacCompagnon · {data().summary || "Mesures conservées"}</p>
          <Show when={data().error}>
            <p role="alert">{data().error}</p>
          </Show>
          <Show when={data().detail}>
            <p class="muted">{data().detail}</p>
          </Show>
          <p class="analysis-scale-note">
            Les barres situent les mesures sur une échelle ; elles ne représentent pas un score.
            Survolez une mesure pour son explication.
          </p>
          <Show when={data().missing.length}>
            <p class="analysis-coverage" role="status">
              Mesures non fournies par ce rapport : {data().missing.join(" · ")}. Une nouvelle
              analyse complète peut les ajouter ; aucune valeur n’est déduite des autres pistes.
            </p>
          </Show>
          <div class="analysis-gauges">
            <For each={data().gauges}>
              {(gauge) => {
                const position = () =>
                  Math.max(
                    0,
                    Math.min(100, ((gauge.value - gauge.low) / (gauge.high - gauge.low)) * 100),
                  );
                return (
                  <figure
                    title={
                      measurementHelp[gauge.label] ??
                      "Mesure de phase locale, à interpréter selon l’enregistrement."
                    }
                  >
                    <figcaption>
                      {gauge.label}
                      <strong>
                        {format(gauge.value)} {gauge.unit}
                      </strong>
                    </figcaption>
                    <svg
                      viewBox="0 0 300 34"
                      role="img"
                      aria-label={`${gauge.label} : ${gauge.value} ${gauge.unit}. Échelle ${gauge.low} à ${gauge.high}.`}
                    >
                      <rect x="0" y="8" width="300" height="8" rx="4" class="graph-track" />
                      <rect
                        x="0"
                        y="8"
                        width={position() * 3}
                        height="8"
                        rx="4"
                        class="graph-value"
                      />
                      <line
                        x1={position() * 3}
                        x2={position() * 3}
                        y1="4"
                        y2="21"
                        class="graph-marker"
                      />
                      <text x="0" y="32">
                        {gauge.low}
                      </text>
                      <text x="300" y="32" text-anchor="end">
                        {gauge.high} {gauge.unit}
                      </text>
                    </svg>
                  </figure>
                );
              }}
            </For>
          </div>
          <p class="analysis-integrity">
            MD5 audio : {data().md5 || "Non renseigné"}
            {data().clipped ? " · Écrêtage détecté" : ""}
          </p>
          <Show when={data().duration && data().retainedEvents}>
            <figure>
              <figcaption>
                Événements détectés{" "}
                <span>
                  {data().eventCount ?? "Nombre total inconnu"} au total · {data().retainedEvents}{" "}
                  positions conservées · {data().events.length} affichées
                </span>
              </figcaption>
              <svg
                class="event-timeline"
                viewBox="0 0 600 65"
                role="img"
                aria-label={`Positions conservées des clics et coupures sur ${data().duration} secondes`}
              >
                <line x1="0" x2="600" y1="32" y2="32" class="graph-marker" />
                <For each={data().events}>
                  {(event) => (
                    <rect
                      x={Math.min(600, (event.start / (data().duration ?? 1)) * 600)}
                      y={event.kind === "Clic" ? 8 : 35}
                      width={Math.max(1, (event.duration / (data().duration ?? 1)) * 600)}
                      height="18"
                      classList={{ "graph-event": true, dropout: event.kind === "Coupure" }}
                    >
                      <title>
                        {event.kind} · {format(event.start)} s · canal {event.channel} · durée{" "}
                        {event.duration} s
                      </title>
                    </rect>
                  )}
                </For>
                <text x="0" y="63">
                  0 s
                </text>
                <text x="600" y="63" text-anchor="end">
                  {format(data().duration ?? 0)} s
                </text>
              </svg>
              <small>
                Clics en haut, coupures en bas. Le JSON contient toutes les positions conservées.
              </small>
            </figure>
          </Show>
          <Show when={!data().gauges.length && !data().retainedEvents}>
            <p class="muted">Ce rapport ne contient pas de mesures représentables.</p>
          </Show>
        </div>
      )}
    </Show>
  );
}
