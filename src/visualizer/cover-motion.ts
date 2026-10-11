import { animateCoverMove } from "./cover-scrub";
/** A fractional viewport keeps entering and leaving covers alive throughout long moves. */
export function coverWindow(position: number, total: number): number[] {
  const first = Math.max(0, Math.floor(position) - 5);
  const last = Math.min(total - 1, Math.ceil(position) + 5);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
}
/** Interruptible compositor positions use the current pose rather than snapping to the previous target. */
export function createCoverMotion(
  publish: (position: number) => void,
  clock = {
    request: (frame: (time: number) => void) => requestAnimationFrame(frame),
    cancel: (id: number) => cancelAnimationFrame(id),
    now: () => performance.now(),
  },
) {
  let position = 0,
    frame: number | undefined,
    disposed = false;
  const cancel = () => {
    if (frame !== undefined) clock.cancel(frame);
    frame = undefined;
  };
  return {
    reset(value: number) {
      cancel();
      position = value;
      publish(value);
    },
    move(target: number) {
      cancel();
      if (disposed || !animateCoverMove(position, target)) return;
      const from = position,
        start = clock.now();
      const duration = Math.min(700, 320 + Math.abs(target - from) * 80);
      const step = (time: number) => {
        frame = undefined;
        if (disposed) return;
        const progress = Math.min(1, Math.max(0, (time - start) / duration));
        position = from + (target - from) * (1 - (1 - progress) ** 3);
        publish(position);
        if (progress < 1) frame = clock.request(step);
      };
      frame = clock.request(step);
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
