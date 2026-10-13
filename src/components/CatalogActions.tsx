import { Show, type JSX } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Controlled catalog actions share order, spacing and exclusive list/Cover Flow selection. */
export function CatalogActions(props: {
  reverseLabel?: string;
  reverse: boolean;
  compact: boolean;
  coverFlow?: boolean;
  onReverse: () => void;
  onCompact: () => void;
  onCoverFlow?: (() => void) | undefined;
  children?: JSX.Element;
}) {
  return (
    <div class="catalog-actions">
      <button
        type="button"
        class="icon-button"
        aria-label={props.reverseLabel ?? t("Inverser l’ordre alphabétique")}
        title={props.reverseLabel ?? t("Inverser l’ordre alphabétique")}
        aria-pressed={props.reverse}
        onClick={props.onReverse}
      >
        <Icon name="sort" />
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label={t("Vue compacte")}
        title={t("Vue compacte")}
        aria-pressed={props.compact}
        onClick={props.onCompact}
      >
        <Icon name="layers" />
      </button>
      <Show when={props.onCoverFlow}>
        <button
          type="button"
          class="icon-button"
          aria-label={t("Cover Flow")}
          title={t("Cover Flow")}
          aria-pressed={props.coverFlow}
          onClick={() => props.onCoverFlow?.()}
        >
          <Icon name="cover-flow" />
        </button>
      </Show>
      {props.children}
    </div>
  );
}
