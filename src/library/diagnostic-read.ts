import { createMemo, createResource, createSignal, onCleanup } from "solid-js";
/** Read cancellation retires presentation admission; an already dispatched native request may finish. */
export interface ReadAdmission {
  current: () => boolean;
}
/** Reads retain owner-scoped confirmations, handle errors locally and refuse overlapping explicit retries. */
export function createDiagnosticRead<Scope extends object, Value>(
  scope: () => Scope | false,
  request: (scope: Scope, admission: ReadAdmission) => Promise<Value>,
) {
  const heldScope = createMemo(scope);
  type Answer = { scope: Scope; data: Value | undefined; error: string };
  const [confirmed, setConfirmed] = createSignal<Answer>();
  const [active, setActive] = createSignal<{ scope: Scope; ticket: number }>();
  let disposed = false,
    sequence = 0;
  onCleanup(() => {
    disposed = true;
    sequence++;
  });
  const [answer, { refetch }] = createResource(heldScope, async (held) => {
    const ticket = ++sequence;
    setActive({ scope: held, ticket });
    const current = () => !disposed && heldScope() === held && active()?.ticket === ticket;
    try {
      const data = await request(held, { current });
      if (current()) setConfirmed({ scope: held, data, error: "" });
    } catch (failure) {
      if (current())
        setConfirmed({
          scope: held,
          data: undefined,
          error: failure instanceof Error ? failure.message : String(failure),
        });
    } finally {
      if (!disposed && active()?.ticket === ticket) setActive(undefined);
    }
  });
  const admitted = createMemo(() => {
    const held = heldScope(),
      row = confirmed();
    return !disposed && held && row?.scope === held ? row : undefined;
  });
  return {
    current: () => admitted()?.data,
    loading: () => !disposed && !!heldScope() && active()?.scope === heldScope(),
    pending: () => !disposed && !!heldScope() && answer.loading,
    error: () => admitted()?.error ?? "",
    cancel() {
      setActive(undefined);
    },
    refetch() {
      if (!disposed && !answer.loading && heldScope()) return refetch();
    },
  };
}
