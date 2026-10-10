import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
/** Transient feedback pauses for reading; each new message owns its own timer. */
export function createFeedback(message: () => string, delay: () => number) {
  const [visible, setVisible] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined,
    remaining = 0,
    started = 0,
    paused = false;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const close = () => {
    clear();
    paused = false;
    setVisible(false);
  };
  const schedule = () => {
    clear();
    if (!paused && remaining > 0 && untrack(visible)) {
      started = Date.now();
      timer = setTimeout(close, remaining);
    }
  };
  createEffect(() => {
    const value = message(),
      duration = delay();
    clear();
    remaining = duration;
    setVisible(!!value);
    schedule();
  });
  onCleanup(clear);
  return {
    visible,
    close,
    pause(value: boolean) {
      if (value === paused) return;
      if (value && timer !== undefined) remaining = Math.max(1, remaining - (Date.now() - started));
      paused = value;
      schedule();
    },
  };
}
