import { Show, createEffect, createSignal, onCleanup, untrack } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
/** A controlled read action exposes Stop only when the caller can retire its current admission. */
export function RefreshButton(props: {
  label?: string;
  busy: boolean;
  /** A page-wide indicator can own activity while this action remains an immediate Stop. */
  busyIndicator?: "spinner" | "stop";
  /** Keep the arrows visible for a complete turn, including immediately completed reads. */
  rotate?: boolean;
  disabled?: boolean;
  onRefresh: () => unknown;
  onCancel?: () => void;
}) {
  const [rotating, setRotating] = createSignal(false);
  let fallback: ReturnType<typeof setTimeout> | undefined;
  function finish() {
    clearTimeout(fallback);
    setRotating(false);
  }
  function begin() {
    clearTimeout(fallback);
    setRotating(true);
    // Hidden/reduced-motion views may not dispatch animation iteration events.
    fallback = setTimeout(finish, 900);
  }
  createEffect(() => {
    if (!props.rotate) finish();
    else if (props.busy) {
      clearTimeout(fallback);
      setRotating(true);
    } else if (untrack(rotating)) fallback = setTimeout(finish, 900);
  });
  onCleanup(() => clearTimeout(fallback));
  function refresh() {
    if (props.busy) props.onCancel?.();
    else if (!rotating()) {
      if (props.rotate) begin();
      void props.onRefresh();
    }
  }
  return (
    <button
      type="button"
      class="icon-button quiet refresh-button"
      disabled={props.disabled || (props.busy && !props.onCancel) || (!props.busy && rotating())}
      aria-busy={props.busy || rotating() || undefined}
      aria-label={props.busy && props.onCancel ? t("Arrêter") : (props.label ?? t("Actualiser"))}
      title={props.busy && props.onCancel ? t("Arrêter") : (props.label ?? t("Actualiser"))}
      onClick={refresh}
    >
      <Show
        when={props.rotate}
        fallback={
          <Show when={props.busy} fallback={<Icon name="refresh" />}>
            <Show when={props.busyIndicator !== "stop"} fallback={<Icon name="stop" />}>
              <ActivityGlyph cancellable={!!props.onCancel} />
            </Show>
          </Show>
        }
      >
        <span
          class="refresh-glyph"
          classList={{ "refresh-rotating": rotating() }}
          onAnimationIteration={(event) => {
            if (event.target === event.currentTarget && !props.busy) finish();
          }}
        >
          <Icon name="refresh" />
        </span>
      </Show>
    </button>
  );
}
