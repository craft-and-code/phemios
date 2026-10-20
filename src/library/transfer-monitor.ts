import { createEffect, createSignal, on, onCleanup } from "solid-js";
import type { TransferStatus } from "./transfers";
/** Poll without overlapping reads; private progress/diagnostics belong to one exact account generation.
 * Account replacement retains only the device-wide running lock until the next native confirmation.
 */
export function createTransferMonitor(
  scope: () => unknown,
  read: () => Promise<TransferStatus>,
  native: () => boolean,
  error: (failure: unknown) => void,
) {
  const [status, setStatus] = createSignal<TransferStatus>({ phase: "idle", running: false });
  let disposed = false,
    polling = false,
    generation = 0;
  createEffect(
    on(scope, () => {
      generation++;
      setStatus((previous) => ({ phase: "idle", running: previous.running }));
    }),
  );
  onCleanup(() => {
    disposed = true;
    generation++;
  });
  function capture() {
    const held = scope(),
      epoch = generation;
    return () => !disposed && held === scope() && epoch === generation;
  }
  async function poll() {
    if (disposed || polling || !native()) return;
    const current = capture();
    polling = true;
    try {
      const next = await read();
      if (current()) setStatus(next);
    } catch (failure) {
      if (current()) error(failure);
    } finally {
      polling = false;
    }
  }
  /** Retire acknowledgements and diagnostics, not an already accepted native transfer. */
  async function command(work: () => Promise<unknown>, accepted?: () => void) {
    if (disposed || !native()) return;
    const current = capture();
    try {
      await work();
      if (!current()) return;
      accepted?.();
      if (current()) await poll();
    } catch (failure) {
      if (current()) error(failure);
    }
  }
  return { status, poll, command };
}
