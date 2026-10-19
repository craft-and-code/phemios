import { For, Show } from "solid-js";
import { ReportDisclosure } from "./ReportDisclosure";
import type { AnalysisModel } from "./model";
import type { ReportTranslate } from "./presentation";
/** Expandable measured evidence remains available through an independently controlled disclosure. */
export function AnalysisTechnical(props: {
  data: AnalysisModel;
  tr: ReportTranslate;
  locale: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const data = () => props.data,
    tr = props.tr;
  return (
    <ReportDisclosure
      label={tr("Mesures complémentaires")}
      open={props.expanded}
      onChange={props.onExpandedChange}
      section
    >
      <dl>
        <For each={data().loudnessPeaks}>
          {(peak) => (
            <>
              <dt>
                {tr(
                  peak.kind === "momentary"
                    ? "LUFS-M max · fenêtre 400 ms"
                    : "LUFS-S max · fenêtre 3 s",
                )}
              </dt>
              <dd>
                {peak.lufs.toLocaleString(props.locale)} LUFS ·{" "}
                {peak.start.toLocaleString(props.locale)} s
              </dd>
            </>
          )}
        </For>
        <Show when={data().dc !== undefined}>
          <dt>{tr("Décalage continu max.")}</dt>
          <dd>{((data().dc ?? 0) * 100).toLocaleString(props.locale)} % FS</dd>
        </Show>
        <Show when={data().balance !== undefined}>
          <dt>{tr("Balance droite − gauche")}</dt>
          <dd>{data().balance?.toLocaleString(props.locale)} dB</dd>
        </Show>
        <Show when={data().lattice !== undefined}>
          <dt>{tr("Indice de signature de quantification")}</dt>
          <dd>
            {data().lattice?.toLocaleString(props.locale, {
              maximumFractionDigits: 5,
            })}
          </dd>
        </Show>
      </dl>
      <p>{tr("L’indice de signature n’est pas une probabilité ni un pourcentage de confiance.")}</p>
    </ReportDisclosure>
  );
}
