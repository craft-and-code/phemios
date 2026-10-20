import { createPersonalActions } from "./personal-actions";
import { createSignal } from "solid-js";
import type { Job } from "./jobs";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
/** Stop requests retain source/login ownership and never replay mutations automatically. */
export function createServiceCancellation(options: {
  session: (source: SourceId) => AccountSession | undefined;
  cancel: (id: number, source: SourceId) => Promise<void>;
}) {
  type Pending = { source: SourceId; token: object };
  type Diagnostic = { source: SourceId; message: string };
  const [diagnostics, setDiagnostics] = createSignal<Record<string, Diagnostic>>({});
  const [pending, setPending] = createSignal<Record<string, Pending>>({});
  const withoutSource = <T extends { source: SourceId }>(
    rows: Record<string, T>,
    source: SourceId,
  ) => Object.fromEntries(Object.entries(rows).filter(([, row]) => row.source !== source));
  const admission = (source: SourceId) =>
    createPersonalActions(
      () => "settings",
      () => options.session(source),
      () => source,
      () => {
        setDiagnostics((rows) => withoutSource(rows, source));
        setPending((rows) => withoutSource(rows, source));
      },
    );
  const admissions = { local: admission("local"), server: admission("server") };
  const key = (id: number, source: SourceId) => `${source}:${id}`;
  async function cancel(id: number, source: SourceId) {
    const current = admissions[source].capture(),
      ticket = key(id, source),
      token = {};
    if (!current() || pending()[ticket]) return;
    setPending((rows) => ({ ...rows, [ticket]: { source, token } }));
    setDiagnostics((rows) =>
      Object.fromEntries(Object.entries(rows).filter(([id]) => id !== ticket)),
    );
    try {
      await options.cancel(id, source);
    } catch (failure) {
      if (current())
        setDiagnostics((rows) => ({ ...rows, [ticket]: { source, message: String(failure) } }));
    } finally {
      setPending((rows) =>
        rows[ticket]?.token !== token
          ? rows
          : Object.fromEntries(Object.entries(rows).filter(([id]) => id !== ticket)),
      );
    }
  }
  return {
    error: () =>
      Object.values(diagnostics())
        .map((row) => row.message)
        .join("\n"),
    clear: () => setDiagnostics({}),
    pending: () => Object.keys(pending()).length > 0,
    pendingJob: (id: number, source: SourceId) => !!pending()[key(id, source)],
    cancel,
    async stopEnrichment(jobs: readonly Job[]) {
      await Promise.all(
        jobs
          .filter((job) => job.kind === "fetch" && ["queued", "running"].includes(job.status))
          .map((job) => cancel(job.task_id, job.source ?? "server")),
      );
    },
  };
}
