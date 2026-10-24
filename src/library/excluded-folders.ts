import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { AccountSession } from "./server";
import { createDiagnosticRead } from "./diagnostic-read";
import { readServerRoots } from "./server-roots";
/** The engine owns exclusions; the UI retains only a selection and admitted operation feedback. */
export function createExcludedFolders(options: {
  session: () => AccountSession | undefined;
  page: (offset: number, owner: AccountSession) => Promise<unknown>;
  pick: (current: () => boolean) => Promise<string[]>;
  change: (path: string, action: "exclude" | "include") => Promise<void>;
}) {
  const scope = createMemo(() => ({ owner: options.session() }));
  const [selected, setSelected] = createSignal<string>();
  const [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  let disposed = false,
    operation = 0;
  onCleanup(() => {
    disposed = true;
    operation++;
  });
  createEffect(
    on(scope, () => {
      operation++;
      setSelected(undefined);
      setError("");
      setBusy(false);
    }),
  );
  const read = createDiagnosticRead(
    () => (scope().owner ? scope() : false),
    (held, admission) =>
      readServerRoots((offset) => options.page(offset, held.owner!), admission.current, "excluded"),
  );
  const selection = () => (read.current()?.includes(selected() ?? "") ? selected() : undefined);
  async function run(work: (current: () => boolean) => Promise<void>) {
    const held = scope();
    if (disposed || !held.owner || held.owner.account.role !== "admin" || busy() || read.pending())
      return;
    const ticket = ++operation;
    const current = () => !disposed && held === scope() && operation === ticket;
    setBusy(true);
    setError("");
    try {
      await work(current);
    } catch (failure) {
      if (current()) setError(String(failure));
    } finally {
      if (current()) {
        setBusy(false);
        await read.refetch();
      }
    }
  }
  return {
    read,
    busy,
    error,
    selection,
    select: setSelected,
    add: () =>
      run(async (current) => {
        const paths = await options.pick(current);
        if (!current()) return;
        for (const path of new Set(paths)) {
          if (!current()) return;
          if (!read.current()?.includes(path)) await options.change(path, "exclude");
        }
      }),
    remove: (path = selection()) =>
      run(async (current) => {
        if (path && read.current()?.includes(path) && current())
          await options.change(path, "include");
      }),
  };
}
