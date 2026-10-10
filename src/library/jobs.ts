import { t } from "../i18n";
import { referenceSource, type SourceId } from "./sources";
import { createSignal, onCleanup } from "solid-js";
import { requestAede } from "../platform/desktop";
export interface Job {
  source?: SourceId;
  task_id: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  kind?: string;
  release?: string;
  task_kind?: string;
  result?: { exit_code: number; stdout: string; stderr: string; output_truncated: boolean };
  error?: { message: string };
}
/** Activity is sourced from confirmed tasks, not a timer pretending to measure progress. */
export function activeReleaseJob(jobs: readonly Job[], release: string): Job | undefined {
  return jobs.find(
    (job) =>
      job.release === release &&
      (job.source ?? "server") === referenceSource(release) &&
      ["queued", "running"].includes(job.status),
  );
}
/** Poll only explicitly started jobs, retaining their IDs across view navigation. */
export function createJobs(connected: () => boolean) {
  const [jobs, setJobs] = createSignal<Job[]>([]),
    [error, setError] = createSignal("");
  let timer: number | undefined,
    disposed = false;
  async function poll() {
    if (disposed || !connected()) {
      timer = undefined;
      return;
    }
    const active = jobs().filter((job) => job.status === "queued" || job.status === "running");
    for (const job of active) {
      try {
        const result = await requestAede<Job>(
          `/api/admin/v1/tasks/${job.task_id}`,
          {},
          "GET",
          null,
          job.source,
        );
        if (disposed) return;
        setJobs((rows) =>
          rows.map((row) =>
            row.task_id === result.task_id && row.source === job.source
              ? { ...row, ...result }
              : row,
          ),
        );
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : t("Suivi de tâche interrompu."));
      }
    }
    if (jobs().some((job) => job.status === "queued" || job.status === "running"))
      timer = window.setTimeout(() => void poll(), 1200);
    else timer = undefined;
  }
  async function start(kind: "analyze" | "spectrum" | "lyrics", release: string, force: boolean) {
    setError("");
    if (jobs().filter((job) => ["queued", "running"].includes(job.status)).length >= 4)
      throw new Error(t("Quatre tâches sont déjà actives."));
    const result = await requestAede<{ task_id: number; status: "queued" }>(
      `/api/admin/v1/${kind}`,
      {},
      "POST",
      kind === "lyrics" ? { track: release } : { release, force, threads: 2 },
    );
    setJobs((rows) => [...rows, { ...result, kind, release, source: referenceSource(release) }]);
    if (timer === undefined) timer = window.setTimeout(() => void poll(), 300);
  }
  async function cancel(id: number, source: SourceId = "server") {
    await requestAede(`/api/admin/v1/tasks/${id}/cancel`, {}, "POST", {}, source);
  }
  onCleanup(() => {
    disposed = true;
    if (timer !== undefined) window.clearTimeout(timer);
  });
  return { jobs, error, start, cancel };
}
