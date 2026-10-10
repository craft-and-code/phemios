export interface QueueLyricsProgress {
  done: number;
  total: number;
  failed: number;
}
/** Deduplicate occurrences, preserve order and acquire one missing track at a time. */
export async function acquireQueueLyrics(
  references: readonly string[],
  options: {
    current: () => boolean;
    available: (ref: string) => Promise<boolean>;
    acquire: (ref: string) => Promise<void>;
    progress: (value: QueueLyricsProgress) => void;
    failure?: (reference: string, reason: string) => void;
  },
) {
  const tracks = [...new Set(references)];
  if (tracks.length > 4096) throw new Error("Queue exceeds lyrics acquisition bound");
  let done = 0,
    failed = 0;
  options.progress({ done, total: tracks.length, failed });
  for (const reference of tracks) {
    if (!options.current()) break;
    try {
      const present = await options.available(reference);
      if (!options.current()) break;
      if (!present) await options.acquire(reference);
    } catch (error) {
      if (!options.current()) break;
      failed++;
      options.failure?.(reference, error instanceof Error ? error.message : String(error));
    }
    if (!options.current()) break;
    done++;
    options.progress({ done, total: tracks.length, failed });
  }
  return { done, total: tracks.length, failed };
}

/** Stop at the first missing reference; never infer availability from a download-button click. */
export async function queueHasLyrics(
  references: readonly string[],
  current: () => boolean,
  read: (reference: string) => Promise<boolean>,
): Promise<boolean> {
  const unique = [...new Set(references)];
  if (!unique.length || unique.length > 4096) return false;
  for (const reference of unique) {
    if (!current() || !(await read(reference)) || !current()) return false;
  }
  return true;
}
