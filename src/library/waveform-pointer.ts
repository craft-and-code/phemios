import { createEffect, createMemo, onCleanup } from "solid-js";
import type { PlaybackState } from "./playback-state";
type Pointer = PointerEvent & { currentTarget: HTMLInputElement };
/** Pointer seeking keeps preview and commit separate from keyboard range input. */
export function createWaveformPointer(options: {
  state: () => PlaybackState;
  disabled: () => boolean;
  position: (event: Pointer) => number;
  hover: (event: Pointer) => void;
  preview: (position: number) => void;
  seek: (position: number) => void;
  clear: () => void;
}) {
  const identity = createMemo(
    () => {
      const value = options.state();
      return { reference: value.reference, queue: value.queue_id, index: value.index };
    },
    undefined,
    {
      equals: (a, b) => a.reference === b.reference && a.queue === b.queue && a.index === b.index,
    },
  );
  let held:
      | { pointer: number; target: HTMLInputElement; identity: ReturnType<typeof identity> }
      | undefined,
    disposed = false;
  function cancel() {
    const previous = held;
    held = undefined;
    if (previous?.target.hasPointerCapture(previous.pointer))
      previous.target.releasePointerCapture(previous.pointer);
    options.clear();
  }
  const valid = () => !disposed && !options.disabled() && held?.identity === identity();
  createEffect(() => {
    identity();
    options.disabled();
    if (held && !valid()) cancel();
  });
  onCleanup(() => {
    disposed = true;
    cancel();
  });
  return {
    down(event: Pointer) {
      if (disposed || options.disabled() || event.button !== 0) return;
      cancel();
      event.preventDefault();
      event.currentTarget.focus();
      held = { pointer: event.pointerId, target: event.currentTarget, identity: identity() };
      event.currentTarget.setPointerCapture(event.pointerId);
      options.hover(event);
      options.preview(options.position(event));
    },
    move(event: Pointer) {
      options.hover(event);
      if (held?.pointer !== event.pointerId) return;
      if (!valid()) {
        cancel();
        return;
      }
      options.preview(options.position(event));
    },
    up(event: Pointer) {
      if (held?.pointer !== event.pointerId) return;
      const accepted = valid();
      const position = accepted ? options.position(event) : undefined;
      cancel();
      if (position !== undefined) options.seek(position);
    },
    cancel,
  };
}
