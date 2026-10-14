import { t } from "../i18n";
import { Icon } from "./Icon";
/** Bounded result navigation uses the same arrows, spacing and disabled admission in every view. */
export function Pagination(props: {
  offset: number;
  size: number;
  total: number;
  count: number;
  busy?: boolean;
  onOffset: (offset: number) => void;
}) {
  return (
    <nav class="page-controls pagination-controls" aria-label={t("Pagination")}>
      <button
        type="button"
        class="icon-button"
        title={t("Précédent")}
        aria-label={t("Précédent")}
        disabled={!!props.busy || props.offset === 0}
        onClick={() => props.onOffset(Math.max(0, props.offset - props.size))}
      >
        <Icon name="back" />
      </button>
      <span>
        {props.total ? props.offset + 1 : 0}–{props.offset + props.count} / {props.total}
      </span>
      <button
        type="button"
        class="icon-button"
        title={t("Suivant")}
        aria-label={t("Suivant")}
        disabled={!!props.busy || props.offset + props.size >= props.total}
        onClick={() => props.onOffset(props.offset + props.size)}
      >
        <Icon name="forward" />
      </button>
    </nav>
  );
}
