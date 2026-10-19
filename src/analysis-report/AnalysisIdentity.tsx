import { For } from "solid-js";
import type { AnalysisModel } from "./model";
import type { ReportTranslate } from "./presentation";
import { Icon } from "../components/Icon";
/** File-declared and signal-derived properties are labelled separately; absent data stays unknown. */
export function AnalysisIdentity(props: {
  data: AnalysisModel;
  tr: ReportTranslate;
  locale: string;
}) {
  const number = (value: number | undefined, unit = "") =>
    value === undefined
      ? props.tr("Non mesuré")
      : `${new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ""}`;
  const facts = () => [
    {
      label: "Extension → format identifié",
      value: `${props.data.extension ? `.${props.data.extension}` : props.tr("Extension inconnue")} → ${props.data.format || props.tr("Format inconnu")}`,
      note:
        props.data.extensionMismatch === true
          ? props.tr("Extension incohérente")
          : props.data.extensionMismatch === false
            ? props.tr("Extension cohérente")
            : props.tr("Correspondance non renseignée"),
      warn: props.data.extensionMismatch === true,
    },
    {
      label: "Codec",
      value:
        [props.data.format, props.data.codec].filter(Boolean).join(" · ") ||
        props.tr("Non renseigné"),
      note: props.tr("Le format sans perte ne certifie pas l’origine de la source."),
    },
    {
      label: "Canaux",
      value:
        props.data.channels === 2
          ? props.tr("2 canaux · stéréo")
          : number(props.data.channels, props.tr("canaux")),
      note:
        props.data.dualMono === true
          ? props.tr("Dual mono détecté")
          : props.data.dualMono === false
            ? props.tr("Dual mono non détecté")
            : props.tr("Dual mono non mesuré"),
      warn: props.data.dualMono === true,
    },
    {
      label: "Profondeur de bits",
      value: props.data.integerDepthApplicable
        ? props.tr(
            "Déclarés : {0} · effectifs : {1}",
            number(props.data.bits),
            `${props.data.effective !== undefined && props.data.bitMethod !== "Stored" ? "≈ " : ""}${number(props.data.effective)}`,
          )
        : props.tr("Non applicable au codec avec pertes"),
      note:
        props.data.stored === undefined
          ? props.tr("La précision effective est une estimation, pas une preuve d’origine.")
          : props.tr(
              "Bits occupés dans les échantillons entiers : {0}.",
              number(props.data.stored),
            ),
      warn:
        props.data.bits !== undefined &&
        props.data.effective !== undefined &&
        props.data.effective < props.data.bits,
    },
    {
      label: "Fréquence d’échantillonnage",
      value:
        props.data.rate === undefined
          ? props.tr("Non mesuré")
          : number(props.data.rate / 1000, "kHz"),
      note: props.tr(
        "Coupure mesurée : {0}",
        props.data.cutoff === undefined
          ? props.tr("Non mesuré")
          : number(props.data.cutoff / 1000, "kHz"),
      ),
    },
    {
      label: "Stéréo et polarité",
      value: props.tr("Corrélation : {0}", number(props.data.correlation)),
      note:
        props.data.inverted === true
          ? props.tr("Inversion de polarité suspectée")
          : props.data.inverted === false
            ? props.tr("Inversion de polarité non signalée")
            : props.tr("Polarité non mesurée"),
      warn: props.data.inverted === true,
    },
    {
      label: "Durée · taille · débit global",
      value: [
        props.data.duration === undefined
          ? props.tr("Non mesuré")
          : `${Math.floor(props.data.duration / 60)}:${String(Math.floor(props.data.duration % 60)).padStart(2, "0")}`,
        props.data.size === undefined
          ? props.tr("Taille inconnue")
          : number(props.data.size / 1_000_000, "Mo"),
        number(props.data.bitrate, "kb/s"),
      ].join(" · "),
      note: props.tr("Débit du fichier entier, conteneur compris."),
    },
  ];
  return (
    <div class="far-identity">
      <For each={facts()}>
        {(fact) => (
          <div>
            <span>{props.tr(fact.label)}</span>
            <strong>{fact.value}</strong>
            <small classList={{ "far-warning": fact.warn }}>
              {fact.warn && <Icon name="missing" />}
              {fact.note}
            </small>
          </div>
        )}
      </For>
    </div>
  );
}
