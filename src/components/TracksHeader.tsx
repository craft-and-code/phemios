import { t } from "../i18n";
import { Icon } from "./Icon";
import { RefreshButton } from "./RefreshButton";
import { StickyHeader } from "./StickyHeader";
/** Pagination and read admission stay above the independent track scroller. */
export function TracksHeader(props: {
  total: number;
  offset: number;
  size: number;
  busy: boolean;
  pending: boolean;
  onRefresh: () => void;
  onCancel: () => void;
  onOffset: (offset: number) => void;
}) {
  return (
    <StickyHeader>
      <div class="section-heading">
        <span>
          {props.total} {t("piste")} · {props.total ? props.offset + 1 : 0}–
          {Math.min(props.offset + props.size, props.total)}
        </span>
        <div class="page-controls">
          <RefreshButton
            busy={props.busy}
            disabled={props.pending && !props.busy}
            onCancel={props.onCancel}
            onRefresh={props.onRefresh}
          />
          <button
            type="button"
            class="icon-button quiet"
            title={t("Précédentes")}
            aria-label={t("Précédentes")}
            disabled={!props.offset || props.busy}
            onClick={() => props.onOffset(Math.max(0, props.offset - props.size))}
          >
            <Icon name="arrow-left" />
          </button>
          <button
            type="button"
            class="icon-button quiet"
            title={t("Suivantes")}
            aria-label={t("Suivantes")}
            disabled={props.busy || props.offset + props.size >= props.total}
            onClick={() => props.onOffset(props.offset + props.size)}
          >
            <Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </StickyHeader>
  );
}
