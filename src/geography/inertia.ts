import { wrapLongitude, type Point } from "./projection";
export interface DragSample {
  x: number;
  y: number;
  time: number;
}
/** Recent pointer speed becomes angular momentum; a held release has no residual impulse. */
export function flingVelocity(
  samples: readonly DragSample[],
  released: number,
  zoom: number,
): Point {
  const last = samples.at(-1),
    first = samples.find((sample) => last && sample.time >= last.time - 80);
  if (!last || !first || released - last.time > 100 || last.time <= first.time || zoom <= 0)
    return [0, 0];
  const elapsed = last.time - first.time;
  return [
    (-(last.x - first.x) * 0.45) / zoom / elapsed,
    ((last.y - first.y) * 0.35) / zoom / elapsed,
  ];
}
/** Finite, frame-rate-independent exponential friction. Stop retires even an already dequeued callback. */
export function createGlobeInertia(io: {
  read: () => Point;
  write: (value: Point) => void;
  enabled: () => boolean;
  now: () => number;
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
}) {
  let frame: number | undefined,
    generation = 0;
  const stop = () => {
    generation++;
    if (frame !== undefined) io.cancel(frame);
    frame = undefined;
  };
  return {
    stop,
    start(velocity: Point) {
      stop();
      if (!io.enabled() || !velocity.every(Number.isFinite)) return;
      let vx = Math.max(-1, Math.min(1, velocity[0])),
        vy = Math.max(-1, Math.min(1, velocity[1]));
      if (Math.hypot(vx, vy) < 0.004) return;
      let previous = io.now();
      const owned = generation;
      const tick: FrameRequestCallback = (now) => {
        if (owned !== generation) return;
        frame = undefined;
        const dt = now - previous;
        if (!io.enabled() || dt < 0 || dt > 100) {
          stop();
          return;
        }
        previous = now;
        const decay = Math.exp(-dt / 210),
          distance = 210 * (1 - decay),
          current = io.read();
        const latitude = Math.max(-80, Math.min(80, current[1] + vy * distance));
        io.write([wrapLongitude(current[0] + vx * distance), latitude]);
        vx *= decay;
        vy *= decay;
        if (Math.abs(latitude) === 80) vy = 0;
        if (Math.hypot(vx, vy) >= 0.004) frame = io.request(tick);
      };
      frame = io.request(tick);
    },
  };
}

/** Browser boundary for the finite controller; native scheduling methods retain their receiver. */
export function createBrowserGlobeInertia(read: () => Point, write: (value: Point) => void) {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return createGlobeInertia({
    read,
    write,
    enabled: () => !document.hidden && !reducedMotion?.matches,
    now: () => performance.now(),
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (id) => window.cancelAnimationFrame(id),
  });
}
