import type { Job } from "./jobs";
/** Fixed server stages in the default whole-library sequence. */
export const generationSteps = ["analyze", "spectrum", "m3u", "lyrics"] as const;
export type GenerationStep = (typeof generationSteps)[number];
/** Reject empty, duplicate and unknown work instead of silently changing a plan. */
export function validGenerationSteps(value: readonly string[]): value is readonly GenerationStep[] {
  return (
    value.length > 0 &&
    value.length <= 4 &&
    new Set(value).size === value.length &&
    value.every((step) => generationSteps.includes(step as GenerationStep))
  );
}
/** Queued and interrupted tracking still reserve admission until the server confirms termination. */
export function administrativeWorkActive(jobs: readonly Job[]): boolean {
  return jobs.some((job) => ["queued", "running"].includes(job.status));
}
/** Restored server kinds retain which action owns the button loader without private client state. */
export function generationForJob(job: Job): GenerationStep | "all" | undefined {
  const kind = job.task_kind?.startsWith("library_generation")
    ? job.task_kind.replace("library_generation", "generate")
    : job.kind;
  if (kind === "generate" || kind === "generate_all") return "all";
  if (!kind?.startsWith("generate_")) return undefined;
  const step = kind.slice("generate_".length);
  return generationSteps.includes(step as GenerationStep) ? (step as GenerationStep) : undefined;
}
