import { createEffect, createSignal, on, Show } from "solid-js";
import { t } from "../i18n";
import { createDownloadFeedback } from "../library/download-feedback";
import { Icon } from "./Icon";
import { Feedback } from "./Feedback";
/** Shared rounded download action: activity, confirmed green check and bounded feedback. */
export function DownloadButton(props: {
  label: string;
  onClick: () => unknown | Promise<unknown>;
  disabled?: boolean;
  busy?: boolean;
  completed?: boolean;
  confirmOnResolve?: boolean;
  icon?: string;
  onError?: (failure: unknown) => void;
  class?: string;
  identity?: unknown;
}) {
  const state = createDownloadFeedback(),
    [error, setError] = createSignal("");
  createEffect(
    on(
      () => props.identity,
      () => {
        state.reset();
        setError("");
      },
    ),
  );
  createEffect(
    on(
      () => props.completed,
      (value, old) => {
        if (value && !old) state.complete();
      },
    ),
  );
  const busy = () => !!props.busy || state.phase() === "busy";
  async function act() {
    if (props.disabled || busy()) return;
    setError("");
    try {
      await state.run(props.onClick, props.confirmOnResolve !== false);
    } catch (failure) {
      if (props.onError) props.onError(failure);
      else setError(failure instanceof Error ? failure.message : String(failure));
    }
  }
  return (
    <>
      <button
        type="button"
        class={`icon-button quiet ${props.class ?? ""}`}
        classList={{ "download-complete": state.phase() === "complete" }}
        disabled={props.disabled || busy()}
        aria-busy={busy()}
        aria-label={props.label}
        title={state.phase() === "complete" ? t("Téléchargement terminé") : props.label}
        onClick={() => void act()}
      >
        <Show
          when={busy()}
          fallback={
            <Icon name={state.phase() === "complete" ? "check" : (props.icon ?? "download")} />
          }
        >
          <span class="spinner" aria-hidden="true" />
        </Show>
      </button>
      <Feedback error message={error()} onClose={() => setError("")} />
    </>
  );
}
