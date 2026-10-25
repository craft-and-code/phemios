import { Show, type JSX } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Controlled actions share order and spacing; a third grid choice is explicit when available. */
export function CatalogActions(props: {
  reverseLabel?: string;
  reverse: boolean;
  compact: boolean;
  coverFlow?: boolean;
  onReverse: () => void;
  onCompact: () => void;
  onGrid?: (() => void) | undefined;
  onCoverFlow?: (() => void) | undefined;
  children?: JSX.Element;
  presentations?: JSX.Element;
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
      <Show
        when={props.presentations}
        fallback={
          <button
            type="button"
            class="icon-button"
            aria-label={t("Vue compacte")}
            title={t("Vue compacte")}
            aria-pressed={props.compact}
            onClick={props.onCompact}
          >
            <Icon name={props.onGrid ? "list" : "layers"} />
          </button>
        }
      >
        {props.presentations}
      </Show>
      <Show when={props.onGrid}>
        <button
          type="button"
          class="icon-button"
          aria-label={t("Vue en grille")}
          title={t("Vue en grille")}
          aria-pressed={!props.compact && !props.coverFlow}
          onClick={() => props.onGrid?.()}
        >
          <Icon name="grid" />
        </button>
      </Show>
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
