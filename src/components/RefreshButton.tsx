import { Show } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
/** A controlled read action exposes Stop only when the caller can retire its current admission. */
export function RefreshButton(props: {
  label?: string;
  busy: boolean;
  /** A page-wide indicator can own activity while this action remains an immediate Stop. */
  busyIndicator?: "spinner" | "stop";
  disabled?: boolean;
  onRefresh: () => unknown;
  onCancel?: () => void;
}) {
  return (
    <button
      type="button"
      class="icon-button quiet refresh-button"
      disabled={props.disabled || (props.busy && !props.onCancel)}
      aria-busy={props.busy || undefined}
      aria-label={props.busy && props.onCancel ? t("Arrêter") : (props.label ?? t("Actualiser"))}
      title={props.busy && props.onCancel ? t("Arrêter") : (props.label ?? t("Actualiser"))}
      onClick={() => (props.busy ? props.onCancel?.() : void props.onRefresh())}
    >
      <Show when={props.busy} fallback={<Icon name="refresh" />}>
        <Show when={props.busyIndicator !== "stop"} fallback={<Icon name="stop" />}>
          <ActivityGlyph cancellable={!!props.onCancel} />
        </Show>
      </Show>
    </button>
  );
}
