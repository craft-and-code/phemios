import { Show } from "solid-js";
import type { IntegrityResult } from "../library/album-integrity";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Equal slots preserve title alignment; only failures with a disclosure callback are interactive. */
export function TrackIntegrity(props: {
  result: IntegrityResult | undefined;
  id?: string;
  controls?: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const label = () =>
    props.result?.status === "ok"
      ? t("Empreinte vérifiée")
      : props.result?.status === "ko"
        ? t("Échec du contrôle d’intégrité")
        : t("Décodage réussi ; aucune empreinte de référence.");
  const tooltip = () =>
    [label(), props.result?.verifier, props.result?.message].filter(Boolean).join(" · ");
  return (
    <Show when={props.result}>
      {(value) => (
        <Show
          when={value().status === "ko" && props.onToggle}
          fallback={
            <span
              class={`track-integrity track-integrity-${value().status}`}
              role="img"
              aria-label={label()}
              title={tooltip()}
            >
              <Show when={value().status !== "no_hash"} fallback="-">
                <Icon name={value().status === "ok" ? "check" : "close"} />
              </Show>
            </span>
          }
        >
          <button
            type="button"
            id={props.id}
            class="track-integrity track-integrity-ko track-integrity-button"
            aria-label={t("Afficher ou masquer le détail de l’erreur d’intégrité")}
            aria-expanded={props.expanded ?? false}
            aria-controls={props.controls}
            title={tooltip()}
            onClick={props.onToggle}
            onKeyDown={(event) => {
              if (event.key === "Escape" && props.expanded) {
                event.preventDefault();
                event.stopPropagation();
                props.onToggle?.();
              } else if (event.code === "Space" || event.key === "Enter") event.stopPropagation();
            }}
          >
            <Icon name="close" />
          </button>
        </Show>
      )}
    </Show>
  );
}
