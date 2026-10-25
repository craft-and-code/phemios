import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { AccountSession } from "./server";
import { createDiagnosticRead } from "./diagnostic-read";
import { objectListAfterRemoval, reorderObjects } from "./object-list";
import type { createExcludedFolderOrder } from "./excluded-folder-order";
import { readServerRoots } from "./server-roots";
/** The engine owns exclusions; the UI retains only a selection and admitted operation feedback. */
export function createExcludedFolders(options: {
  session: () => AccountSession | undefined;
  order?: ReturnType<typeof createExcludedFolderOrder>;
  page: (offset: number, owner: AccountSession) => Promise<unknown>;
  pick: (current: () => boolean) => Promise<string[]>;
  change: (path: string, action: "exclude" | "include") => Promise<void>;
}) {
  const scope = createMemo(() => ({ owner: options.session() }));
  const [selected, setSelected] = createSignal<readonly string[]>([]);
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
      setSelected([]);
      setError("");
      setBusy(false);
    }),
  );
  const read = createDiagnosticRead(
    () => (scope().owner ? scope() : false),
    async (held, admission) => {
      const paths = await readServerRoots(
        (offset) => options.page(offset, held.owner!),
        admission.current,
        "excluded",
      );
      if (!admission.current()) return [];
      return options.order ? options.order.read(held.owner!, paths) : paths;
    },
  );
  const selections = createMemo(() => {
    const chosen = new Set(selected());
    return (read.current() ?? []).filter((path) => chosen.has(path));
  });
  const selection = () => selections()[0];
  const selectMany = (paths: readonly string[]) => {
    const admitted = new Set(read.current() ?? []);
    setSelected([...new Set(paths.filter((path) => admitted.has(path)))]);
  };
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
    selections,
    select: (path: string | undefined) => selectMany(path === undefined ? [] : [path]),
    selectMany,
    add: () =>
      run(async (current) => {
        const paths = await options.pick(current);
        if (!current()) return;
        for (const path of new Set(paths)) {
          if (!current()) return;
          if (!read.current()?.includes(path)) await options.change(path, "exclude");
        }
      }),
    move: (path: string, before?: string) =>
      run(async (current) => {
        const owner = scope().owner,
          paths = read.current();
        if (owner && paths?.includes(path) && options.order && current())
          await options.order.save(owner, reorderObjects(paths, path, before), current);
      }),
    remove: (path?: string) =>
      run(async (current) => {
        let paths = [...(read.current() ?? [])];
        const targets = path === undefined ? selections() : paths.filter((item) => item === path);
        for (const target of targets) {
          if (!current()) return;
          const next = objectListAfterRemoval(paths, target);
          await options.change(target, "include");
          if (!current()) return;
          paths = paths.filter((item) => item !== target);
          const remaining = selected().filter((item) => paths.includes(item));
          setSelected(remaining.length ? remaining : next === undefined ? [] : [next]);
        }
      }),
  };
}
