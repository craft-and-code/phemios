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
  if (options.discogs) {
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
      !status.capabilities.includes("fetch_discogs")
    )
      throw new Error(
        t("Mettez à jour puis redémarrez Aède pour récupérer les biographies Discogs des labels."),
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
