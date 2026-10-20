import { For, Show } from "solid-js";
import { t, countryName } from "../i18n";
import { ActionButton } from "./ActionButton";
import { Icon } from "./Icon";
import type { SourceReviewItem, ReviewDecision } from "../library/source-review";
const detailLabels: Record<string, string> = {
  type: "Type",
  area: "Région",
  country: "Pays",
  began: "Début",
  ended: "Fin",
  disambiguation: "Précision",
  date: "Date",
};
/** Local names, external evidence and explicit human decisions remain visibly distinct. */
export function SourceReviewCard(props: {
  row: SourceReviewItem;
  busy: boolean;
  disabled: boolean;
  biographyAvailable: boolean;
  onDecision: (decision: ReviewDecision) => void;
  onBiography: () => void;
}) {
  const label = () =>
    props.row.kind === "artist"
      ? t("Artiste")
      : props.row.kind === "release"
        ? t("Album")
        : props.row.kind === "track"
          ? t("Piste")
          : t("Label");
  return (
    <article class="source-review-card">
      <div class="source-review-identity">
        <span class="eyebrow">{label()}</span>
        <strong>{props.row.name}</strong>
        <Show when={props.row.local_mbid}>
          <small class="muted">
            {t("Identifiant lu dans les fichiers : {0}", props.row.local_mbid)}
          </small>
        </Show>
      </div>
      <div class="source-review-evidence">
        <span>
          {t("Proposition MusicBrainz")}
          {props.row.score !== null ? ` · ${props.row.score}/100` : ""}
        </span>
        <Show
          when={props.row.url}
          fallback={<code>{props.row.source_id ?? t("Identifiant absent")}</code>}
        >
          {(url) => (
            <a href={url()} target="_blank" rel="noopener noreferrer">
              {t("Vérifier sur MusicBrainz")} <Icon name="external" />
            </a>
          )}
        </Show>
        <dl>
          <For each={props.row.details}>
            {([label, value]) => (
              <>
                <dt>{t(detailLabels[label] ?? label)}</dt>
                <dd>{label === "country" ? countryName(value, value) : value}</dd>
              </>
            )}
          </For>
        </dl>
      </div>
      <div class="source-review-actions">
        <span class="muted">
          {props.row.decision === "accepted"
            ? t("Validée")
            : props.row.decision === "rejected"
              ? t("Refusée")
              : t("À vérifier")}
        </span>
        <Show when={props.row.decision !== "accepted"}>
          <ActionButton
            icon="check"
            disabled={props.disabled || !props.row.url}
            busy={props.busy}
            onClick={() => props.onDecision("accept")}
          >
            {t("Valider")}
          </ActionButton>
        </Show>
        <Show when={props.row.kind === "artist" && props.row.decision !== "rejected"}>
          <ActionButton
            icon="book"
            disabled={props.disabled || !props.biographyAvailable || !props.row.url}
            onClick={props.onBiography}
          >
            {props.row.decision === "accepted"
              ? t("Récupérer la biographie")
              : t("Valider et récupérer la biographie")}
          </ActionButton>
        </Show>
        <Show when={props.row.decision !== "rejected"}>
          <ActionButton
            icon="close"
            disabled={props.disabled}
            onClick={() => props.onDecision("reject")}
          >
            {t("Refuser")}
          </ActionButton>
        </Show>
        <Show when={props.row.decision !== null}>
          <ActionButton
            icon="refresh"
            disabled={props.disabled}
            onClick={() => props.onDecision("undo")}
          >
            {t("Annuler la décision")}
          </ActionButton>
        </Show>
      </div>
    </article>
  );
}
