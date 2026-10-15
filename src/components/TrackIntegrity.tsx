import { Show } from "solid-js";
import type { IntegrityResult } from "../library/album-integrity";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Absence remains invisible before a fresh test; successful decoding without a digest stays distinct. */
export function TrackIntegrity(props: { result: IntegrityResult | undefined }) {
  const label = () =>
    props.result?.status === "ok"
      ? t("Empreinte vérifiée")
      : props.result?.status === "ko"
        ? t("Échec du contrôle d’intégrité")
        : t("Décodage réussi ; aucune empreinte de référence.");
  return (
    <Show when={props.result}>
      {(value) => (
        <span
          class={`track-integrity track-integrity-${value().status}`}
          role="img"
          aria-label={label()}
          title={[label(), value().verifier, value().message].filter(Boolean).join(" · ")}
        >
          <Show when={value().status !== "no_hash"} fallback="-">
            <Icon name={value().status === "ok" ? "check" : "close"} />
          </Show>
        </span>
      )}
    </Show>
  );
}
