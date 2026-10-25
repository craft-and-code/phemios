import { aedeAvailability, inlineAedeError } from "../library/aede-availability";
import { aedeDiagnostics, isAedeDiagnosticError } from "../library/aede-diagnostics";
import { createEffect, Show } from "solid-js";
import { t } from "../i18n";
import { createFeedback } from "../library/feedback";
import { Icon } from "./Icon";
/** Action acknowledgements share dismissal and bounded, wrappable presentation. */
export function Feedback(props: {
  message: string;
  /** The single shell notice displays transport errors suppressed in individual views. */
  connectionNotice?: boolean;
  error?: boolean;
  onClose?: () => void;
  class?: string;
  persistent?: boolean;
  durationMs?: number;
  pauseOnInteraction?: boolean;
}) {
  const message = () =>
    props.error
      ? inlineAedeError(props.message, !props.connectionNotice && aedeAvailability.ownsSession())
      : props.message;
  const state = createFeedback(message, () => props.durationMs ?? (props.error ? 15000 : 10000));
  let hovered = false,
    focused = false;
  const pause = () =>
    state.pause(!!props.persistent || (props.pauseOnInteraction !== false && (hovered || focused)));
  createEffect(() => {
    void props.message;
    pause();
  });
  return (
    <Show when={state.visible()}>
      <span
        class={`feedback ${props.class ?? ""}`}
        classList={{ "feedback-error": props.error }}
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
        <span>
          {message()}
          <Show when={props.error && isAedeDiagnosticError(message())}>
            {" "}
            <button
              type="button"
              class="feedback-diagnostic-link"
              aria-haspopup="dialog"
              onClick={aedeDiagnostics.open}
            >
              {t("Voir le diagnostic")}
            </button>
          </Show>
        </span>
        <button
          type="button"
          class="icon-button quiet icon-close feedback-close"
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
