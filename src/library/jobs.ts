import { createGenerations } from "./generation-jobs";
import { validFeatureProgress, type FeatureProgress } from "./mood-features";
import { startEnrichment, startSourceEnrichment, hasActiveEnrichment } from "./enrichment";
import type { AccountSession } from "./server";
import { t } from "../i18n";
import { referenceSource, type SourceId } from "./sources";
import { createSignal, createEffect, onCleanup } from "solid-js";
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
  tracking_error?: string;
  progress?: FeatureProgress;
}
/** Activity is sourced from confirmed tasks, not a timer pretending to measure progress. */
export function activeReleaseJob(jobs: readonly Job[], release: string): Job | undefined {
  return jobs.find(
    (job) =>
      job.release === release &&
      (job.source ?? "server") === referenceSource(release) &&
      ["queued", "running"].includes(job.status) &&
      !job.tracking_error,
  );
}
/** Poll only explicitly started jobs, retaining their IDs across view navigation. */
export function createJobs(
  connected: () => boolean,
  options?: {
    session: (source: SourceId) => AccountSession | undefined;
    changed: (source: SourceId) => Promise<void>;
  },
) {
  const [jobs, setJobs] = createSignal<Job[]>([]),
    [error, setError] = createSignal(""),
    [enrichmentPending, setEnrichmentPending] = createSignal(false);
  let timer: number | undefined,
    disposed = false;
  async function poll() {
    if (disposed || !connected()) {
      timer = undefined;
      return;
    }
    const active = jobs().filter(
      (job) => !job.tracking_error && ["queued", "running"].includes(job.status),
    );
    for (const job of active) {
      const source = job.source ?? "server",
        identity = options?.session(source);
      try {
        const result = await requestAede<Job>(
          `/api/admin/v1/tasks/${job.task_id}`,
          {},
          "GET",
          null,
          job.source,
        );
        if (disposed) return;
        if (options && identity !== options.session(source)) continue;
        if (
          !validFeatureProgress(result.progress) ||
          result.task_id !== job.task_id ||
          !["queued", "running", "completed", "failed", "cancelled"].includes(result.status)
        )
          throw new Error(t("Suivi de tâche Aède invalide."));
        setJobs((rows) =>
          rows.map((row) =>
            row.task_id === result.task_id && row.source === job.source
              ? { ...row, ...result }
              : row,
          ),
        );
        if (
          ["completed", "failed", "cancelled"].includes(result.status) &&
          (job.kind === "fetch" || job.kind?.startsWith("generate"))
        )
          await options?.changed(source);
      } catch (failure) {
        if (options && identity !== options.session(source)) continue;
        const message =
          failure instanceof Error ? failure.message : t("Suivi de tâche interrompu.");
        setError(message);
        setJobs((rows) =>
          rows.map((row) =>
            row.task_id === job.task_id && row.source === job.source
              ? { ...row, tracking_error: message }
              : row,
          ),
        );
      }
    }
    if (jobs().some((job) => !job.tracking_error && ["queued", "running"].includes(job.status)))
      timer = window.setTimeout(() => void poll(), 1200);
    else timer = undefined;
  }
  function track(
    result: { task_id: number; status?: Job["status"] },
    kind: string,
    source: SourceId,
    release?: string,
  ) {
    if (!Number.isSafeInteger(result.task_id) || result.task_id <= 0)
      throw new Error(t("Suivi de tâche Aède invalide."));
    setJobs((rows) => [
      ...rows.filter((row) => row.source !== source || row.task_id !== result.task_id),
      {
        task_id: result.task_id,
        status: result.status ?? "queued",
        kind,
        source,
        ...(release ? { release } : {}),
      },
    ]);
    if (timer === undefined) timer = window.setTimeout(() => void poll(), 300);
  }
  async function restore(source: SourceId) {
    const identity = options?.session(source),
      known = new Set(
        jobs()
          .filter((row) => row.source === source)
          .map((row) => row.task_id),
      );
    try {
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        source,
      );
      if (
        disposed ||
        (options && identity !== options.session(source)) ||
        !info.capabilities?.includes("administrative_tasks_list")
      )
        return;
      const rows = await requestAede<Job[]>("/api/admin/v1/tasks", {}, "GET", null, source);
      if (disposed || (options && identity !== options.session(source))) return;
      if (
        !Array.isArray(rows) ||
        rows.length > 64 ||
        rows.some(
          (row) =>
            !row ||
            !validFeatureProgress(row.progress) ||
            !Number.isSafeInteger(row.task_id) ||
            row.task_id <= 0 ||
            !["queued", "running", "completed", "failed", "cancelled"].includes(row.status),
        ) ||
        new Set(rows.map((row) => row.task_id)).size !== rows.length
      )
        throw new Error(t("Suivi de tâche Aède invalide."));
      const finished = rows.some((row) => {
        const previous = jobs().find(
          (held) => held.source === source && held.task_id === row.task_id,
        );
        return (
          (previous?.kind === "fetch" || previous?.kind?.startsWith("generate")) &&
          ["queued", "running"].includes(previous.status) &&
          ["completed", "failed", "cancelled"].includes(row.status)
        );
      });
      setJobs((held) => [
        ...held.filter((row) => row.source !== source),
        ...rows.map((row) => {
          const local = held.find((old) => old.source === source && old.task_id === row.task_id);
          const kind =
            local?.kind ??
            (row.task_kind === "identification"
              ? "fetch"
              : row.task_kind?.startsWith("library_generation")
                ? row.task_kind.replace("library_generation", "generate")
                : (row.kind ?? row.task_kind));
          const restored = { ...local, ...row, source, ...(kind === undefined ? {} : { kind }) };
          delete restored.tracking_error;
          return restored;
        }),
        ...held.filter(
          (row) =>
            row.source === source &&
            !known.has(row.task_id) &&
            !rows.some((remote) => remote.task_id === row.task_id),
        ),
      ]);
      if (finished) await options?.changed(source);
      if (disposed || (options && identity !== options.session(source))) return;
      if (timer === undefined && rows.some((row) => ["queued", "running"].includes(row.status)))
        timer = window.setTimeout(() => void poll(), 300);
    } catch (failure) {
      if (!disposed && (!options || identity === options.session(source)))
        setError(String(failure));
    }
  }
  if (options) {
    const owners = new Map<SourceId, AccountSession | undefined>();
    createEffect(() => {
      for (const source of ["local", "server"] as const) {
        const identity = options.session(source);
        if (owners.get(source) !== identity) {
          owners.set(source, identity);
          setJobs((rows) => rows.filter((row) => row.source !== source));
          if (identity?.account.role === "admin") void restore(source);
        }
      }
    });
  }
  async function start(
    kind: "analyze" | "spectrum" | "lyrics" | "check",
    release: string,
    force: boolean,
  ) {
    setError("");
    if (jobs().filter((job) => ["queued", "running"].includes(job.status)).length >= 4)
      throw new Error(t("Quatre tâches sont déjà actives."));
    const source = referenceSource(release),
      identity = options?.session(source);
    if (kind === "check") {
      if (identity?.account.role !== "admin")
        throw new Error(t("Droits administrateur nécessaires."));
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        source,
        identity,
      );
      if (options && identity !== options.session(source)) throw new Error(t("Session invalide."));
      if (!info.capabilities?.includes("album_decode_results"))
        throw new Error(t("Mettez à jour puis redémarrez Aède pour tester cet album."));
      const result = await requestAede<{ task_id: number; status: "queued" }>(
        "/api/admin/v1/check",
        {},
        "POST",
        { release },
        source,
        identity,
      );
      if (options && identity !== options.session(source)) throw new Error(t("Session invalide."));
      track(result, kind, source, release);
      return result.task_id;
    }
    const result = await requestAede<{ task_id: number; status: "queued" }>(
      `/api/admin/v1/${kind}`,
      {},
      "POST",
      kind === "lyrics" ? { track: release } : { release, force, threads: 2 },
    );
    if (options && identity !== options.session(source)) throw new Error(t("Session invalide."));
    track(result, kind, source, release);
    return result.task_id;
  }
  /** Extract shared audio facts explicitly; retain work across navigation and refuse duplicate submissions. */
  async function features(source: SourceId) {
    if (
      jobs().some(
        (job) =>
          job.source === source &&
          job.kind === "mood_features" &&
          ["queued", "running"].includes(job.status),
      )
    )
      throw new Error(t("Une extraction audio est déjà active."));
    if (jobs().filter((job) => ["queued", "running"].includes(job.status)).length >= 4)
      throw new Error(t("Quatre tâches sont déjà actives."));
    const identity = options?.session(source);
    if (options && identity?.account.role !== "admin")
      throw new Error(t("Droits administrateur nécessaires."));
    const result = await requestAede<{ task_id: number; status: "queued" }>(
      "/api/admin/v1/mood-features",
      {},
      "POST",
      { force: false },
      source,
    );
    if (disposed || (options && identity !== options.session(source)))
      throw new Error(t("Session invalide."));
    track(result, "mood_features", source);
    return result.task_id;
  }
  /** Submission remains owned by the library when the initiating settings view is closed. */
  async function enrich(sources: readonly SourceId[], input: Record<string, boolean>) {
    if (enrichmentPending() || hasActiveEnrichment(jobs())) return undefined;
    setEnrichmentPending(true);
    const owners = new Map(sources.map((source) => [source, options?.session(source)]));
    const current = (source: SourceId) =>
      !disposed && (!options || owners.get(source) === options.session(source));
    try {
      const results = await startEnrichment(sources, (source) =>
        startSourceEnrichment(source, input, () => current(source)),
      );
      return results.map((result) => {
        if (!current(result.source))
          return { source: result.source, error: t("Session invalide.") };
        if ("task" in result) track({ task_id: result.task }, "fetch", result.source);
        return result;
      });
    } finally {
      setEnrichmentPending(false);
    }
  }
  async function cancel(id: number, source: SourceId = "server") {
    await requestAede(`/api/admin/v1/tasks/${id}/cancel`, {}, "POST", null, source);
  }
  onCleanup(() => {
    disposed = true;
    if (timer !== undefined) window.clearTimeout(timer);
  });
  const generations = createGenerations({
    jobs,
    session: (source) => options?.session(source),
    accepted: (task, kind, source) => track(task, kind, source),
    recover: restore,
  });
  return {
    jobs,
    error,
    start,
    cancel,
    track,
    restore,
    enrich,
    enrichmentPending,
    features,
    generate: generations.start,
    generationPending: generations.pending,
  };
}
