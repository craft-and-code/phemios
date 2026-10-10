/** Adjacent moves retain their animation; large jumps and scrubbing place all covers immediately. */
export function animateCoverMove(from: number, to: number, scrubbing: boolean) {
  return !scrubbing && Math.abs(to - from) === 1;
}
/** Coalesce high-rate slider input into one bounded cover window per frame; release commits the latest target. */
export function createCoverScrub(
  publish: (target: number) => void,
  request: (callback: () => void) => number = (callback) => requestAnimationFrame(callback),
  cancel: (id: number) => void = (id) => cancelAnimationFrame(id),
) {
  let frame: number | undefined,
    latest: number | undefined,
    disposed = false;
  function finish() {
    if (frame !== undefined) cancel(frame);
    frame = undefined;
    const value = latest;
    latest = undefined;
    if (!disposed && value !== undefined) publish(value);
  }
  function cancelPending() {
    if (frame !== undefined) cancel(frame);
    frame = undefined;
    latest = undefined;
  }
  return {
    cancel: cancelPending,
    move(target: number) {
      if (disposed || !Number.isFinite(target)) return;
      latest = target;
      if (frame === undefined)
        frame = request(() => {
          frame = undefined;
          finish();
        });
    },
    finish,
    dispose() {
      disposed = true;
      cancelPending();
    },
  };
}
