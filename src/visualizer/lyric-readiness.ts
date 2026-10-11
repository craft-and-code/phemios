import { createSignal, type Accessor } from "solid-js";
/** Reveal only the fitted current cue; delayed measurements cannot reveal a replacement phrase. */
export function createLyricReadiness<T extends object>(phrase: Accessor<T | undefined>) {
  const [measured, setMeasured] = createSignal<T>();
  return {
    ready: () => phrase() !== undefined && measured() === phrase(),
    measured(value: T | undefined) {
      if (value !== undefined && value === phrase()) setMeasured(() => value);
    },
  };
}
