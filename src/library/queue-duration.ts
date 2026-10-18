/** Sum occurrences, including repeats, without treating an unavailable duration as zero. */
export function queueDuration(
  rows: readonly { reference: string }[],
  durations: ReadonlyMap<string, number | null>,
): { milliseconds: number; unknown: number } {
  let milliseconds = 0,
    unknown = 0;
  for (const row of rows) {
    const duration = durations.get(row.reference);
    if (
      duration === undefined ||
      duration === null ||
      !Number.isSafeInteger(duration) ||
      duration < 0 ||
      !Number.isSafeInteger(milliseconds + duration)
    )
      unknown++;
    else milliseconds += duration;
  }
  return { milliseconds, unknown };
}
