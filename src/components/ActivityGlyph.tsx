import { Show } from "solid-js";
import { Icon } from "./Icon";
/** Keep the spinner's box fixed; a cancellable action reveals Stop on hover or keyboard focus. */
export function ActivityGlyph(props: { cancellable?: boolean }) {
  return (
    <span class="activity-glyph" aria-hidden="true">
      <span class="spinner" />
      <Show when={props.cancellable}>
        <span class="activity-stop">
          <Icon name="stop" />
        </span>
      </Show>
    </span>
  );
}
