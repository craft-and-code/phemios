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
  async function poll() {
    if (disposed || polling || !native()) return;
    const held = scope(),
      epoch = generation;
    const current = () => !disposed && held === scope() && epoch === generation;
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
  return { status, poll };
}
