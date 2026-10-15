import { Show } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
/** Clearing is unavailable for an empty queue; native acknowledgement owns the pending state. */
export function QueueClearButton(props: {
  count: number;
  busy: boolean;
  clearing: boolean;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      class="icon-button quiet"
      aria-label={t("Vider la liste de lecture")}
      title={t("Vider la liste et arrêter la lecture")}
      aria-busy={props.clearing || undefined}
      disabled={!props.count || props.busy || props.clearing}
      onClick={props.onClear}
    >
      <Show when={props.clearing} fallback={<Icon name="trash" />}>
        <ActivityGlyph />
      </Show>
    </button>
  );
}
