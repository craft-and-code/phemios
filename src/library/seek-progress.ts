import { t } from "../i18n";
import { createEffect, createSignal, type Accessor } from "solid-js";
import type { PlaybackState } from "./playback-state";
/** Keep a committed cursor stable until the actor acknowledges its seek ticket, coalescing rapid choices. */
export function createSeekProgress(
  state: Accessor<PlaybackState>,
  send: (position: number) => Promise<unknown>,
  failure: (message: string) => void,
) {
  const [pending, setPending] = createSignal<{
    reference: string;
    position: number;
    serial: number;
    ticket?: number;
  }>();
  const [draft, setDraft] = createSignal<{ reference: string; position: number }>();
  let queue: number | undefined,
    running = false,
    serial = 0,
    lifetime = 0;
  const terminal = (status: string) => ["idle", "ended", "error"].includes(status);
  let scope = state();
  function synchronizeScope() {
    const value = state();
    if (
      value.reference !== scope.reference ||
      value.queue_id !== scope.queue_id ||
      value.index !== scope.index ||
      (terminal(value.status) && !terminal(scope.status))
    ) {
      reset();
    }
    scope = value;
  }
  createEffect(() => {
    synchronizeScope();
    const value = state(),
      held = pending();
    if (draft()?.reference !== value.reference) setDraft(undefined);
    if (
      held &&
      (held.reference !== value.reference ||
        ["idle", "ended", "error"].includes(value.status) ||
        (held.ticket !== undefined &&
          value.seek_id >= held.ticket &&
          value.status !== "connecting"))
    )
      setPending(undefined);
  });
  async function seek(position: number) {
    synchronizeScope();
    const value = state();
    if (
      terminal(value.status) ||
      !value.reference ||
      !Number.isSafeInteger(position) ||
      position < 0 ||
      (value.duration_ms !== null && position > value.duration_ms)
    )
      return;
    const request = ++serial;
    setPending({ reference: value.reference, position, serial: request });
    setDraft(undefined);
    queue = position;
    if (running) return;
    running = true;
    const epoch = lifetime,
      reference = value.reference;
    try {
      while (queue !== undefined && epoch === lifetime && state().reference === reference) {
        const selected = queue,
          selectedSerial = serial;
        queue = undefined;
        let reply: unknown;
        try {
          reply = await send(selected);
        } catch (error) {
          synchronizeScope();
          // A newer explicit choice is separate work, not a retry of the refused position.
          if (epoch === lifetime && queue !== undefined && selectedSerial !== serial) continue;
          throw error;
        }
        synchronizeScope();
        if (epoch !== lifetime) break;
        const ticket = (reply as { seek_id?: unknown } | null)?.seek_id;
        if (!Number.isSafeInteger(ticket) || Number(ticket) <= 0)
          throw new Error(t("Déplacement non confirmé ; mettez à jour puis redémarrez Phémios."));
        if (pending()?.serial === selectedSerial)
          setPending({
            reference,
            position: selected,
            serial: selectedSerial,
            ticket: Number(ticket),
          });
      }
    } catch (error) {
      synchronizeScope();
      if (epoch === lifetime) {
        setPending(undefined);
        queue = undefined;
        failure(error instanceof Error ? error.message : t("Déplacement impossible."));
      }
    } finally {
      if (epoch === lifetime) running = false;
    }
  }
  function reset() {
    lifetime++;
    running = false;
    setDraft(undefined);
    queue = undefined;
    setPending(undefined);
  }
  return {
    seek,
    reset,
    preview: (position: number) => setDraft({ reference: state().reference, position }),
    clearPreview: () => setDraft(undefined),
    pending: () => !!pending(),
    position: () => {
      const value = state();
      return (
        (draft()?.reference === value.reference ? draft()?.position : undefined) ??
        (pending()?.reference === value.reference ? pending()?.position : undefined) ??
        value.position_ms
      );
    },
  };
}
