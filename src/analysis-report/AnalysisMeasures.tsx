import { EventTimeline } from "./EventTimeline";
import { MeasurementGauge } from "./MeasurementGauge";
import { ReportDisclosure } from "./ReportDisclosure";
import { For, Show } from "solid-js";
import type { AnalysisModel } from "./model";
import { type ReportTranslate } from "./presentation";
import { Icon } from "../components/Icon";
/** Measured descriptors and retained positions; no synthetic waveform or inferred missing values. */
export function AnalysisMeasures(props: {
  data: AnalysisModel;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  tr: ReportTranslate;
  locale: string;
}) {
  const number = (value: number) =>
    new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(value);
  const primary = () =>
    props.data.gauges.filter((g) =>
      ["Niveau intégré", "Dynamique", "Étendue de sonie"].includes(g.label),
    );
  const additional = () =>
    props.data.gauges.filter(
      (g) => !["Niveau intégré", "Dynamique", "Étendue de sonie"].includes(g.label),
    );
  return (
    <>
      <section class="far-section">
        <h3>{props.tr("Ce que décrivent les niveaux")}</h3>
        <div class="far-measures">
          <For each={primary()}>
            {(gauge) => <MeasurementGauge gauge={gauge} tr={props.tr} locale={props.locale} />}
          </For>
        </div>
        <Show when={additional().length}>
          <ReportDisclosure
            label={props.tr("Autres mesures")}
            open={props.expanded}
            onChange={props.onExpandedChange}
          >
            <div class="far-measures far-additional">
              <For each={additional()}>
                {(gauge) => <MeasurementGauge gauge={gauge} tr={props.tr} locale={props.locale} />}
              </For>
            </div>
          </ReportDisclosure>
        </Show>
        <Show when={!props.data.gauges.length}>
          <p class="far-muted">
            {props.tr("Ce rapport ne contient pas de mesures représentables.")}
          </p>
        </Show>
        <p class="far-hint">
          {props.tr("Repères descriptifs, sans note globale ni plage « bon / mauvais ».")}
        </p>
      </section>
      <section class="far-section">
        <h3>{props.tr("À regarder ou à écouter")}</h3>
        <For each={props.data.gauges.filter((g) => g.label === "Crête vraie")}>
          {(gauge) => (
            <div class="far-observation" classList={{ "far-warning": gauge.value > 0 }}>
              <Icon name={gauge.value > 0 ? "missing" : "wave"} />
              <div>
                <strong>
                  {props.tr("Crête vraie")} : {number(gauge.value)} dBTP
                </strong>
                <p>
                  {props.tr(
                    "Estimation des crêtes entre les échantillons ; distincte de l’écrêtage des échantillons.",
                  )}
                </p>
              </div>
            </div>
          )}
        </For>
        <div class="far-observation" classList={{ "far-warning": props.data.clipped === true }}>
          <Icon name={props.data.clipped === true ? "missing" : "wave"} />
          <div>
            <strong>
              {props.tr(
                props.data.clipped === true
                  ? "Écrêtage détecté."
                  : props.data.clipped === false
                    ? "Aucun écrêtage signalé."
                    : "Écrêtage non renseigné.",
              )}
            </strong>
            <Show when={props.data.clipEvents !== undefined}>
              <p>
                {props.tr(
                  "{0} événement(s) · {1} échantillon(s)",
                  props.data.clipEvents,
                  props.data.clippedSamples ?? props.tr("Non renseigné"),
                )}
              </p>
            </Show>
          </div>
        </div>
        <div
          class="far-observation"
          classList={{ "far-warning": (props.data.eventCount ?? props.data.events.length) > 0 }}
        >
          <Icon
            name={(props.data.eventCount ?? props.data.events.length) > 0 ? "missing" : "wave"}
          />
          <div>
            <strong>
              {props.data.eventCount === undefined
                ? props.tr("Nombre de clics/coupures inconnu.")
                : props.tr("{0} clic(s)/coupure(s) détecté(s).", props.data.eventCount)}
            </strong>
            <p>
              {props.tr(
                "Ces événements peuvent appartenir à l’enregistrement. Vérifiez les passages à l’oreille.",
              )}
            </p>
          </div>
        </div>
        <Show when={props.data.duration && props.data.events.length}>
          <EventTimeline
            events={props.data.events}
            duration={props.data.duration ?? 0}
            locale={props.locale}
            tr={props.tr}
          />
        </Show>
        <Show when={props.data.retainedEvents > 0}>
          <p class="far-hint">
            {props.tr(
              "{0} positions conservées · {1} affichées",
              props.data.retainedEvents,
              props.data.events.length,
            )}
          </p>
        </Show>
      </section>
    </>
  );
}
