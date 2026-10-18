import { Show } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Inline continuation keeps the arrow and its replacement activity indicator in one fixed slot. */
export function BiographyMore(props: { busy: boolean; disabled: boolean; onOpen: () => void }) {
  return (
    <>
      {" "}
      <button
        type="button"
        class="metadata-link biography-more"
        disabled={props.disabled || props.busy}
        aria-busy={props.busy}
        onClick={props.onOpen}
      >
        <span>{t("Lire plus")}</span>
        <span class="biography-more-icon">
          <Show when={props.busy} fallback={<Icon name="forward" />}>
            <span class="spinner" />
          </Show>
        </span>
      </button>
    </>
  );
}
