import { createMemo, createResource, onCleanup } from "solid-js";
/** Statistics and Doctor reads resolve failures locally so retry controls remain mounted.
 * Retained values/errors belong to the exact source/session/parameter scope; disposal ends admission.
 */
export function createDiagnosticRead<Scope extends object, Value>(
  scope: () => Scope | false,
  request: (scope: Scope) => Promise<Value>,
) {
  const heldScope = createMemo(scope);
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const [answer, { refetch }] = createResource(heldScope, async (held) => {
    const current = () => !disposed && heldScope() === held;
    try {
      const data = await request(held);
      if (!current()) return undefined;
      return { scope: held, data, error: "" };
    } catch (failure) {
      if (!current()) return undefined;
      return {
        scope: held,
        data: undefined,
        error: failure instanceof Error ? failure.message : String(failure),
      };
    }
  });
  const admitted = createMemo(() => {
    const held = heldScope(),
      row = answer();
    return !disposed && held && row?.scope === held ? row : undefined;
  });
  return {
    current: () => (disposed ? undefined : admitted()?.data),
    loading: () => !disposed && !!heldScope() && answer.loading,
    error: () => (disposed ? "" : (admitted()?.error ?? "")),
    refetch,
  };
}
