/** Confirmed native extraction progress; counts never estimate the remaining work. */
export interface FeatureProgress {
  phase: "" | "analyzing" | "waiting_for_playback" | "finished";
  done: number;
  total: number;
  analyzed: number;
  reused: number;
  failed: number;
}
/** Legacy task replies omit progress; malformed new progress must not become a success indicator. */
export function validFeatureProgress(raw: unknown): raw is FeatureProgress | undefined {
  if (raw === undefined) return true;
  const row = raw as FeatureProgress;
  return (
    !!row &&
    ["", "analyzing", "waiting_for_playback", "finished"].includes(row.phase) &&
    [row.done, row.total, row.analyzed, row.reused, row.failed].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 16384,
    ) &&
    row.done <= row.total &&
    row.analyzed + row.reused + row.failed === row.done
  );
}
