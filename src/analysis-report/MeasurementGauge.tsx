import type { Gauge } from "./measurements";
import { MeasurementMarker } from "./MeasurementMarker";
import { measureHelp, type ReportTranslate } from "./presentation";
/** The entire rail is a touch target; values remain visible without interaction. */
export function MeasurementGauge(props: { gauge: Gauge; tr: ReportTranslate; locale: string }) {
  const value = () =>
    `${new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(props.gauge.value)} ${props.gauge.unit}`.trim();
  const help = () =>
    props.tr(
      measureHelp[props.gauge.label] ??
        "Mesure de phase locale, à interpréter selon l’enregistrement.",
    );
  return (
    <figure>
      <figcaption>{props.tr(props.gauge.label)}</figcaption>
      <strong>
        {new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(
          props.gauge.value,
        )}{" "}
        <small>{props.gauge.unit}</small>
      </strong>
      <MeasurementMarker
        position={
          (100 * (props.gauge.value - props.gauge.low)) / (props.gauge.high - props.gauge.low)
        }
        label={props.tr(props.gauge.label)}
        value={value()}
        help={help()}
      />
      <div class="far-scale-labels">
        <span>{props.gauge.low}</span>
        <span>
          {props.gauge.high} {props.gauge.unit}
        </span>
      </div>
      <p>{help()}</p>
    </figure>
  );
}
