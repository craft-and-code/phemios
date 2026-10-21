type Scope = { lifetime: number; profile: object };
type Worker = Scope & { pending: number | undefined; running: boolean; completion: Promise<void> };
/** Coalesce unsent numeric audio settings within one transport/profile lifetime.
 * Retired IPC may finish; it cannot block a successor or drain its pending choice.
 * Apply must admit acknowledgements and errors with current(), and handle its failures.
 * settled() waits for the current scope only, without changing nonblocking coalesced calls.
 */
export function createAudioSettingQueue(
  scope: () => Scope,
  apply: (value: number, current: () => boolean, pending: () => boolean) => Promise<void>,
) {
  let worker: Worker | undefined;
  const matches = (left: Scope, right: Scope) =>
    left.lifetime === right.lifetime && left.profile === right.profile;
  const enqueue = async (value: number) => {
    const captured = scope();
    if (!worker || !matches(worker, captured))
      worker = { ...captured, pending: undefined, running: false, completion: Promise.resolve() };
    const held = worker;
    held.pending = value;
    if (held.running) return;
    held.running = true;
    let finish = () => {};
    held.completion = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const current = () => held === worker && matches(held, scope());
    try {
      while (held.pending !== undefined && current()) {
        const chosen = held.pending;
        held.pending = undefined;
        await apply(chosen, current, () => held.pending !== undefined);
      }
    } finally {
      held.running = false;
      finish();
    }
  };
  return Object.assign(enqueue, {
    settled: () => (worker && matches(worker, scope()) ? worker.completion : Promise.resolve()),
  });
}
