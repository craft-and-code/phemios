import type { Job } from "./jobs";
import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import type { SourceId } from "./sources";
/** Explicit operations share one configuration but report every source's independent outcome. */
export async function startEnrichment(
  sources: readonly SourceId[],
  start: (source: SourceId) => Promise<{ task_id: number }>,
) {
  const results = await Promise.allSettled(sources.map((source) => start(source)));
  return results.map((result, i) => ({
    source: sources[i]!,
    ...(result.status === "fulfilled"
      ? { task: result.value.task_id }
      : { error: String(result.reason) }),
  }));
}

/** Confirm additive Discogs support on the captured library before submitting a non-replayed job. */
export async function startSourceEnrichment(
  source: SourceId,
  options: Record<string, boolean>,
  isCurrent: () => boolean,
): Promise<{ task_id: number }> {
  if (options.discogs || options.musicbrainz) {
    const status = await requestAede<{ capabilities?: unknown }>(
      "/api/v1/status",
      {},
      "GET",
      undefined,
      source,
    );
    if (
      !status ||
      !Array.isArray(status.capabilities) ||
      (options.discogs && !status.capabilities.includes("fetch_discogs"))
    )
      throw new Error(
        t("Mettez à jour puis redémarrez Aède pour récupérer les biographies Discogs des labels."),
      );
    if (
      options.musicbrainz &&
      (!Array.isArray(status?.capabilities) ||
        !status.capabilities.includes("fetch_musicbrainz_first"))
    )
      throw new Error(
        t(
          "Mettez à jour puis redémarrez Aède pour identifier les nouveaux artistes avec MusicBrainz avant l’enrichissement.",
        ),
      );
  }
  if (!isCurrent()) throw new Error(t("Session invalide."));
  const result = await requestAede<{ task_id: number }>(
    "/api/admin/v1/fetch",
    {},
    "POST",
    options,
    source,
  );
  if (!isCurrent()) throw new Error(t("Session invalide."));
  return result;
}

/** Unknown tracking outcomes remain active until Aède confirms completion or the session changes. */
export function hasActiveEnrichment(jobs: readonly Job[]): boolean {
  return jobs.some((job) => job.kind === "fetch" && ["queued", "running"].includes(job.status));
}
/** Keep active work visible and limit completed diagnostics without deleting Aède task records. */
export function visibleEnrichmentJobs(jobs: readonly Job[]): Job[] {
  const rows = jobs.filter((job) => job.kind === "fetch").reverse();
  return [
    ...rows.filter((job) => ["queued", "running"].includes(job.status)),
    ...rows.filter((job) => !["queued", "running"].includes(job.status)).slice(0, 3),
  ];
}
