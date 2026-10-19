import { createMemo, createSignal, onCleanup } from "solid-js";
import type { createJobs } from "./jobs";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { t } from "../i18n";
/** One settings projection selects a scan; the library owns its tracking across navigation. */
export function createLibraryScan(options: {
  session: (source: SourceId) => AccountSession | undefined;
  tasks: Pick<ReturnType<typeof createJobs>, "jobs" | "track" | "restore" | "cancel">;
}) {
  const scopes = {
    local: createMemo(() => ({ owner: options.session("local") })),
    server: createMemo(() => ({ owner: options.session("server") })),
  };
  const [selected, setSelected] = createSignal<{
    id: number;
    source: SourceId;
    scope: ReturnType<typeof scopes.local>;
  }>();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const task = () => {
    const held = selected();
    return !disposed && held && held.scope === scopes[held.source]()
      ? options.tasks.jobs().find((row) => row.task_id === held.id && row.source === held.source)
      : undefined;
  };
  return {
    task,
    source: () => selected()?.source ?? "local",
    async start(
      source: SourceId,
      submit: (owner: AccountSession) => Promise<{ task_id: number; status: "queued" }>,
    ) {
      const scope = scopes[source]();
      if (disposed || scope.owner?.account.role !== "admin")
        throw new Error(t("Droits administrateur nécessaires."));
      const result = await submit(scope.owner);
      if (disposed || scope !== scopes[source]()) return false;
      options.tasks.track(result, "scan", source);
      setSelected({ id: result.task_id, source, scope });
      return true;
    },
    async refresh() {
      if (task()) await options.tasks.restore(selected()!.source);
    },
    async cancel() {
      const current = task();
      if (current) await options.tasks.cancel(current.task_id, selected()!.source);
    },
  };
}
