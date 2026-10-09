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
