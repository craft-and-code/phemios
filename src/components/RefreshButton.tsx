import { Show, type JSX } from "solid-js";
import { t } from "../i18n";
import { Icon } from "./Icon";
import { ActivityGlyph } from "./ActivityGlyph";
import { createRefreshActivity } from "../library/refresh-activity";
/** Every explicit refresh acknowledges one second; Stop retires its captured request and feedback. */
export function RefreshButton(props: {
  /** Stable account/target identity, independent from the request's busy/revision state. */
  identity?: unknown;
  label?: string;
  children?: JSX.Element;
  busy: boolean;
  /** A retired native read can still hold the transport slot after its visible activity stops. */
  pending?: boolean;
  disabled?: boolean;
  class?: string;
  onRefresh: (event: MouseEvent, signal: AbortSignal) => unknown;
  onCancel?: (() => void) | undefined;
}) {
  const activity = createRefreshActivity(
    () => props.identity,
    () => props.busy,
  );
  const visible = () => props.busy || activity.visible() || activity.pending();
  const disabled = () => props.disabled || (!!props.pending && !visible());
  function refresh(event: MouseEvent) {
    if (disabled()) return;
    if (visible()) {
      activity.clear();
      props.onCancel?.();
    } else {
      const signal = activity.begin();
      try {
        activity.track(signal, props.onRefresh(event, signal));
      } catch (failure) {
        activity.clear();
        throw failure;
      }
    }
  }
  return (
    <button
      type="button"
      class={`${props.children ? "action-button action-button-with-icon" : "icon-button quiet"} refresh-button ${props.class ?? ""}`}
      disabled={disabled()}
      aria-busy={visible() || undefined}
      aria-label={visible() ? t("Arrêter") : (props.label ?? t("Actualiser"))}
      title={visible() ? t("Arrêter") : (props.label ?? t("Actualiser"))}
      onClick={refresh}
    >
      <Show when={visible()} fallback={<Icon name="refresh" />}>
        <ActivityGlyph cancellable />
      </Show>
      <Show when={props.children}>{(label) => <span>{label()}</span>}</Show>
    </button>
  );
}
