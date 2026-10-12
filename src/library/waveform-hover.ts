import { createMemo, createSignal, type Accessor } from "solid-js";
import { waveformPosition } from "./waveform";

/** Pointer targeting never moves the consumed clock; a new track or unavailable seek clears it. */
export function createWaveformHover(reference: Accessor<string>, disabled: Accessor<boolean>) {
  const source = createMemo(reference),
    enabled = createMemo(() => !disabled()),
    identity = createMemo(() => ({ reference: source(), enabled: enabled() })),
    [target, setTarget] = createSignal<{
      identity: ReturnType<typeof identity>;
      position: number;
    }>();
  return {
    position: () => {
      const current = identity(),
        value = target();
      return current.enabled && current.reference && value?.identity === current
        ? value.position
        : undefined;
    },
    move(x: number, left: number, width: number, duration: number) {
      const current = identity();
      if (
        !current.enabled ||
        !current.reference ||
        !Number.isFinite(x) ||
        !Number.isFinite(left) ||
        !Number.isFinite(width) ||
        width <= 0 ||
        x < left ||
        x > left + width ||
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        setTarget(undefined);
        return;
      }
      setTarget({ identity: current, position: waveformPosition(x, left, width, duration) });
    },
    clear: () => setTarget(undefined),
  };
}
