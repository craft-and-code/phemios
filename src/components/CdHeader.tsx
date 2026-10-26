import { Show } from "solid-js";
import type { CdDrive } from "../cd/model";
import { t } from "../i18n";
import { ActionButton } from "./ActionButton";
import { Icon } from "./Icon";
import { RefreshButton } from "./RefreshButton";
import { StickyHeader } from "./StickyHeader";

/** Optical actions remain visible without a drive; active native reading blocks probing/ejection. */
export function CdHeader(props: {
  drive: CdDrive | undefined;
  native: boolean;
  opening: boolean;
  ejecting: boolean;
  pending: boolean;
  loading: boolean;
  reading: boolean;
  discPlaying: boolean;
  transportBusy: boolean;
  onOpen: () => void;
  onEject: () => void;
  onRefresh: () => unknown;
  onCancel: () => void;
}) {
  const ejectLabel = () => (props.drive?.image ? t("Fermer l’image CD") : t("Éjecter le CD"));
  return (
    <StickyHeader>
      <div class="page-heading">
        <span>{t("Lecteurs CD audio")}</span>
        <div class="cd-header-actions">
          <ActionButton
            icon="folder"
            busy={props.opening}
            disabled={
              !props.native ||
              props.pending ||
              props.ejecting ||
              props.reading ||
              props.transportBusy
            }
            onClick={props.onOpen}
          >
            {t("Ouvrir une image CUE")}
          </ActionButton>
          <button
            type="button"
            class="icon-button"
            title={ejectLabel()}
            aria-label={ejectLabel()}
            aria-busy={props.ejecting}
            disabled={
              !props.native ||
              !props.drive ||
              props.pending ||
              props.opening ||
              props.discPlaying ||
              props.ejecting ||
              props.transportBusy
            }
            onClick={props.onEject}
          >
            <Show when={!props.ejecting} fallback={<span class="spinner" />}>
              <Icon name={props.drive?.image ? "close" : "eject"} />
            </Show>
          </button>
          <RefreshButton
            label={
              props.reading
                ? t("Arrêtez la lecture du CD pour actualiser les lecteurs.")
                : t("Actualiser")
            }
            busy={props.loading}
            disabled={
              !props.native ||
              props.ejecting ||
              props.opening ||
              props.reading ||
              props.transportBusy ||
              (props.pending && !props.loading)
            }
            onCancel={props.onCancel}
            onRefresh={props.onRefresh}
          />
        </div>
      </div>
    </StickyHeader>
  );
}
