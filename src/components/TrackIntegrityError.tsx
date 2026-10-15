import { Show } from "solid-js";
import type { IntegrityResult } from "../library/album-integrity";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Display the current verifier's text literally, without fetching or exporting a report. */
export function TrackIntegrityError(props: {
  id: string;
  result: IntegrityResult | undefined;
  onClose: () => void;
}) {
  return (
    <Show when={props.result?.status === "ko" && props.result}>
      {(value) => (
        <section
          id={props.id}
          class="track-integrity-error"
          role="region"
          aria-labelledby={`${props.id}-heading`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              props.onClose();
            } else if (event.code === "Space" || event.key === "Enter") event.stopPropagation();
          }}
        >
          <div class="analysis-result-heading">
            <strong id={`${props.id}-heading`}>{t("Détail de l’erreur d’intégrité")}</strong>
            <button
              type="button"
              class="icon-button quiet icon-close"
              aria-label={t("Fermer le détail de l’erreur")}
              onClick={props.onClose}
            >
              <Icon name="close" />
            </button>
          </div>
          <Show when={value().verifier !== "Failed"}>
            <p class="muted">{value().verifier}</p>
          </Show>
          <p class="track-integrity-diagnostic">
            {value().message?.trim() ||
              t("Le vérificateur n’a fourni aucun détail supplémentaire.")}
          </p>
        </section>
      )}
    </Show>
  );
}
