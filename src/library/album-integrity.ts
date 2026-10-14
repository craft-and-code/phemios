import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { t } from "../i18n";
import { referenceSource, type SourceId } from "./sources";
import type { AccountSession } from "./server";
import type { Job } from "./jobs";
/** Aède track keys are literal file paths; unwrap only Phémios's leading source qualifier. */
export function integrityPath(reference: string): string | undefined {
  if (!reference.startsWith("track:")) return;
  let path = reference.slice(6);
  for (const prefix of ["@phemios/local/", "@phemios/server/"])
    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length);
      break;
    }
  if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\")) return path;
}
export interface IntegrityResult {
  status: "ok" | "ko" | "no_hash";
  verifier: string;
  message?: string;
}
/** Exact current files must all be represented; truncated/foreign output never becomes a verdict. */
export function parseIntegrityResults(
  output: NonNullable<Job["result"]>,
  paths: readonly string[],
) {
  const invalid = () => new Error(t("Résultat d’intégrité Aède invalide ou incomplet."));
  if (
    output.output_truncated ||
    output.stdout.length > 65536 ||
    !Number.isSafeInteger(output.exit_code) ||
    output.exit_code < 0 ||
    output.exit_code > 255
  )
    throw invalid();
  const report = JSON.parse(output.stdout) as { version?: unknown; files?: unknown };
  const expected = new Set(paths);
  if (
    !report ||
    report.version !== 1 ||
    !Array.isArray(report.files) ||
    report.files.length !== expected.size ||
    !expected.size ||
    paths.some((path) => !path)
  )
    throw invalid();
  const results = new Map<string, IntegrityResult>();
  for (const value of report.files) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.path !== "string" ||
      !expected.has(value.path) ||
      results.has(value.path) ||
      !["ok", "ko", "no_hash"].includes(value.status) ||
      typeof value.verifier !== "string" ||
      !value.verifier.trim() ||
      value.verifier.length > 256 ||
      (value.message !== undefined &&
        (typeof value.message !== "string" || value.message.length > 4096))
    )
      throw invalid();
    results.set(value.path, {
      status: value.status,
      verifier: value.verifier,
      ...(value.message === undefined ? {} : { message: value.message }),
    });
  }
  if ((output.exit_code === 0) !== ![...results.values()].some((value) => value.status === "ko"))
    throw invalid();
  return results;
}
/** One mounted album owns only the check it explicitly starts; historical task results stay invisible. */
export function createAlbumIntegrity(options: {
  release: () => string;
  session: () => AccountSession | undefined;
  paths: () => readonly string[];
  jobs: () => readonly Job[];
  start: (release: string) => Promise<number>;
  cancel: (id: number, source: SourceId) => Promise<unknown>;
}) {
  const scope = createMemo(() => ({ release: options.release(), owner: options.session() }));
  const [task, setTask] = createSignal<{ id: number; scope: ReturnType<typeof scope> }>(),
    [pending, setPending] = createSignal(false),
    [error, setError] = createSignal("");
  let generation = 0,
    disposed = false;
  createEffect(
    on(
      scope,
      () => {
        generation++;
        setTask(undefined);
        setPending(false);
        setError("");
      },
      { defer: true },
    ),
  );
  onCleanup(() => {
    disposed = true;
    generation++;
  });
  const current = createMemo(() =>
    options
      .jobs()
      .find(
        (job) =>
          task()?.scope === scope() &&
          job.task_id === task()?.id &&
          job.source === referenceSource(scope().release) &&
          job.release === scope().release &&
          job.kind === "check",
      ),
  );
  const active = createMemo(() =>
    options
      .jobs()
      .find(
        (job) =>
          job.release === scope().release &&
          job.source === referenceSource(scope().release) &&
          job.kind === "check" &&
          ["queued", "running"].includes(job.status),
      ),
  );
  const result = createMemo(() => {
    const job = current();
    if (!scope().owner || !job?.result || !["completed", "failed"].includes(job.status))
      return { values: new Map<string, IntegrityResult>(), error: "" };
    try {
      return { values: parseIntegrityResults(job.result, options.paths()), error: "" };
    } catch (failure) {
      return { values: new Map<string, IntegrityResult>(), error: String(failure) };
    }
  });
  return {
    busy: () => pending() || !!active(),
    canCancel: () => !!active(),
    enabled: () =>
      scope().owner?.account.role === "admin" &&
      options.paths().length > 0 &&
      options.paths().every(Boolean),
    result: (path: string | undefined) =>
      path === undefined ? undefined : result().values.get(path),
    error: () =>
      error() ||
      current()?.tracking_error ||
      result().error ||
      (!current()?.result ? (current()?.error?.message ?? "") : ""),
    async start() {
      if (disposed || this.busy() || !this.enabled()) return;
      const captured = scope(),
        ticket = ++generation;
      setTask(undefined);
      setError("");
      setPending(true);
      try {
        const id = await options.start(captured.release);
        if (!disposed && ticket === generation && scope() === captured)
          setTask({ id, scope: captured });
      } catch (failure) {
        if (!disposed && ticket === generation && scope() === captured) setError(String(failure));
      } finally {
        if (!disposed && ticket === generation && scope() === captured) setPending(false);
      }
    },
    async cancel() {
      const job = active(),
        captured = scope(),
        ticket = generation;
      if (!job || disposed || captured.owner?.account.role !== "admin") return;
      try {
        await options.cancel(job.task_id, referenceSource(captured.release));
      } catch (failure) {
        if (!disposed && ticket === generation && scope() === captured) setError(String(failure));
      }
    },
  };
}
