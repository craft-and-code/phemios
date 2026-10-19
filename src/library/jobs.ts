import { createGenerations } from "./generation-jobs";
import { validFeatureProgress, type FeatureProgress } from "./mood-features";
import { startEnrichment, startSourceEnrichment, hasActiveEnrichment } from "./enrichment";
import type { AccountSession } from "./server";
import { createJobRefresh } from "./job-refresh";
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
  partial_result?: Job["result"];
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
/** Retain task IDs across navigation; source generations and task revisions reject late reads. */
export function createJobs(
  connected: () => boolean,
  options?: {
    session: (source: SourceId) => AccountSession | undefined;
    changed: (source: SourceId) => Promise<void>;
  },
) {
  const [jobs, setJobs] = createSignal<Job[]>([]),
    [diagnostic, setDiagnostic] = createSignal<{
      source: SourceId;
      task: number | undefined;
      message: string;
    }>(),
    [enrichmentPending, setEnrichmentPending] = createSignal(false);
  const error = () => diagnostic()?.message ?? "";
  const refresh = createJobRefresh(async (source) => {
    await options?.changed(source);
  });
  let timer: number | undefined,
    disposed = false;
  // Returning to the same account object must not revive an earlier login's requests.
  const epochs: Record<SourceId, number> = { local: 0, server: 0 };
  const capture = (source: SourceId) => {
    const owner = options?.session(source),
      epoch = epochs[source];
    return {
      owner,
      current: () =>
        !disposed && epoch === epochs[source] && (!options || owner === options.session(source)),
    };
  };
  async function poll() {
    if (disposed || !connected()) {
      timer = undefined;
      return;
    }
    const active = jobs().filter(
      (job) => !job.tracking_error && ["queued", "running"].includes(job.status),
    );
    for (const job of active) {
      if (disposed) return;
      if (!jobs().includes(job)) continue;
      const source = job.source ?? "server",
        context = capture(source);
      let tracked = job;
      const current = () => context.current() && jobs().includes(tracked);
      const failed = (failure: unknown) => {
        if (!current()) return;
        const message =
          failure instanceof Error ? failure.message : t("Suivi de tâche interrompu.");
        setDiagnostic({ source, task: job.task_id, message });
        setJobs((rows) =>
          rows.map((row) =>
            row.task_id === job.task_id && row.source === job.source
              ? { ...row, tracking_error: message }
              : row,
          ),
        );
      };
      try {
        const result = await requestAede<Job>(
          `/api/admin/v1/tasks/${job.task_id}`,
          {},
          "GET",
          null,
          source,
          context.owner,
        );
        if (disposed) return;
        if (!current()) continue;
        if (
          !validFeatureProgress(result.progress) ||
          result.task_id !== job.task_id ||
          !["queued", "running", "completed", "failed", "cancelled"].includes(result.status)
        )
          throw new Error(t("Suivi de tâche Aède invalide."));
        setJobs((rows) =>
          rows.map((row) => {
            if (row.task_id !== result.task_id || row.source !== job.source) return row;
            tracked = { ...row, ...result };
            if (!result.partial_result) delete tracked.partial_result;
            return tracked;
          }),
        );
        if (current() && diagnostic()?.source === source && diagnostic()?.task === job.task_id)
          setDiagnostic(undefined);
        if (
          current() &&
          ["completed", "failed", "cancelled"].includes(result.status) &&
          (job.kind === "scan" || job.kind === "fetch" || job.kind?.startsWith("generate"))
        )
          // Catalogue refresh has its own lifetime; it cannot stall another task's verdicts.
          void refresh.request(source, context.current).catch(failed);
      } catch (failure) {
        failed(failure);
      }
    }
    if (
      !disposed &&
      jobs().some((job) => !job.tracking_error && ["queued", "running"].includes(job.status))
    )
      timer = window.setTimeout(() => void poll(), 1200);
    else timer = undefined;
  }
  function track(
    result: { task_id: number; status?: Job["status"] },
    kind: string,
    source: SourceId,
    release?: string,
  ) {
    if (disposed) throw new Error(t("Session invalide."));
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
    const context = capture(source);
    if (!context.current()) return;
    const previousDiagnostic = diagnostic();
    // Keep updates made after this recovery started, even if the older list omits that task.
    const known = new Map(
      jobs()
        .filter((row) => row.source === source)
        .map((row) => [row.task_id, row]),
    );
    try {
      const info = await requestAede<{ capabilities?: string[] }>(
        "/api/v1/status",
        {},
        "GET",
        null,
        source,
        context.owner,
      );
      if (!context.current() || !info.capabilities?.includes("administrative_tasks_list")) return;
      const rows = await requestAede<Job[]>(
        "/api/admin/v1/tasks",
        {},
        "GET",
        null,
        source,
        context.owner,
      );
      if (!context.current()) return;
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
          previous === known.get(row.task_id) &&
          (previous?.kind === "scan" ||
            previous?.kind === "fetch" ||
            previous?.kind?.startsWith("generate")) &&
          ["queued", "running"].includes(previous.status) &&
          ["completed", "failed", "cancelled"].includes(row.status)
        );
      });
      setJobs((held) => [
        ...held.filter((row) => row.source !== source),
        ...rows.map((row) => {
          const local = held.find((old) => old.source === source && old.task_id === row.task_id);
          if (local && local !== known.get(row.task_id)) return local;
          const kind =
            local?.kind ??
            (row.task_kind === "identification"
              ? "fetch"
              : row.task_kind?.startsWith("library_generation")
                ? row.task_kind.replace("library_generation", "generate")
                : (row.kind ?? row.task_kind));
          const restored = { ...local, ...row, source, ...(kind === undefined ? {} : { kind }) };
          delete restored.tracking_error;
          if (!row.partial_result) delete restored.partial_result;
          return restored;
        }),
        ...held.filter(
          (row) =>
            row.source === source &&
            known.get(row.task_id) !== row &&
            !rows.some((remote) => remote.task_id === row.task_id),
        ),
      ]);
      if (!context.current()) return;
      // A successful read retires only the error this recovery actually observed.
      if (diagnostic() === previousDiagnostic && previousDiagnostic?.source === source)
        setDiagnostic(undefined);
      if (
        timer === undefined &&
        jobs().some((row) => !row.tracking_error && ["queued", "running"].includes(row.status))
      )
        timer = window.setTimeout(() => void poll(), 300);
      // Catalog synchronization must not hold up independent task progress.
      if (finished) await refresh.request(source, context.current);
    } catch (failure) {
      if (context.current()) setDiagnostic({ source, task: undefined, message: String(failure) });
    }
  }
  if (options) {
    const owners = new Map<SourceId, AccountSession | undefined>();
    createEffect(() => {
      for (const source of ["local", "server"] as const) {
        const identity = options.session(source);
        if (owners.get(source) !== identity) {
          owners.set(source, identity);
          epochs[source]++;
          if (diagnostic()?.source === source) setDiagnostic(undefined);
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
    if (disposed) throw new Error(t("Session invalide."));
    setDiagnostic(undefined);
    if (jobs().filter((job) => ["queued", "running"].includes(job.status)).length >= 4)
      throw new Error(t("Quatre tâches sont déjà actives."));
    const source = referenceSource(release),
      context = capture(source),
      identity = context.owner;
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
      if (!context.current()) throw new Error(t("Session invalide."));
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
      if (!context.current()) throw new Error(t("Session invalide."));
      track(result, kind, source, release);
      return result.task_id;
    }
    const result = await requestAede<{ task_id: number; status: "queued" }>(
      `/api/admin/v1/${kind}`,
      {},
      "POST",
      kind === "lyrics" ? { track: release } : { release, force, threads: 2 },
    );
    if (!context.current()) throw new Error(t("Session invalide."));
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
    const context = capture(source),
      identity = context.owner;
    if (!context.current()) throw new Error(t("Session invalide."));
    if (options && identity?.account.role !== "admin")
      throw new Error(t("Droits administrateur nécessaires."));
    const result = await requestAede<{ task_id: number; status: "queued" }>(
      "/api/admin/v1/mood-features",
      {},
      "POST",
      { force: false },
      source,
    );
    if (!context.current()) throw new Error(t("Session invalide."));
    track(result, "mood_features", source);
    return result.task_id;
  }
  /** Submission remains owned by the library when the initiating settings view is closed. */
  async function enrich(sources: readonly SourceId[], input: Record<string, boolean>) {
    if (enrichmentPending() || hasActiveEnrichment(jobs())) return undefined;
    setEnrichmentPending(true);
    const scopes = new Map(sources.map((source) => [source, capture(source)]));
    const current = (source: SourceId) => scopes.get(source)?.current() === true;
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
    const context = capture(source);
    if (!context.current()) throw new Error(t("Session invalide."));
    await requestAede(`/api/admin/v1/tasks/${id}/cancel`, {}, "POST", null, source, context.owner);
    if (!context.current()) return;
    // A transient tracking failure must not leave a successfully cancelled job busy forever.
    let resumed = false;
    setJobs((rows) =>
      rows.map((row) => {
        if (
          row.source !== source ||
          row.task_id !== id ||
          !row.tracking_error ||
          !["queued", "running"].includes(row.status)
        )
          return row;
        const updated = { ...row };
        delete updated.tracking_error;
        resumed = true;
        return updated;
      }),
    );
    if (resumed && timer === undefined) timer = window.setTimeout(() => void poll(), 300);
  }
  onCleanup(() => {
    disposed = true;
    refresh.dispose();
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
