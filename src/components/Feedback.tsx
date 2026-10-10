import { Show } from "solid-js";
import { t } from "../i18n";
import { createFeedback } from "../library/feedback";
import { Icon } from "./Icon";
/** Action acknowledgements share dismissal and bounded, wrappable presentation. */
export function Feedback(props: {
  message: string;
  error?: boolean;
  onClose?: () => void;
  class?: string;
}) {
  const state = createFeedback(
    () => props.message,
    () => (props.error ? 15000 : 10000),
  );
  let hovered = false,
    focused = false;
  const pause = () => state.pause(hovered || focused);
  return (
    <Show when={state.visible()}>
      <span
        class={`feedback ${props.class ?? ""}`}
        role={props.error ? "alert" : "status"}
        onPointerEnter={() => {
          hovered = true;
          pause();
        }}
        onPointerLeave={() => {
          hovered = false;
          pause();
        }}
        onFocusIn={() => {
          focused = true;
          pause();
        }}
        onFocusOut={(event) => {
          focused =
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget);
          pause();
        }}
      >
        <span>{props.message}</span>
        <button
          type="button"
          class="icon-button quiet icon-close"
          aria-label={t("Masquer la notification")}
          title={t("Masquer la notification")}
          onClick={() => {
            hovered = false;
            focused = false;
            state.close();
            props.onClose?.();
          }}
        >
          <Icon name="close" />
        </button>
      </span>
    </Show>
  );
}
