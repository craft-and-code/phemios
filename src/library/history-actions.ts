import type { HistoryRow } from "./personal-reads";
/** History visits retain their underlying playback identity independently of album membership. */
export function historyTrackAction(row: Pick<HistoryRow, "track" | "release" | "error">) {
  return {
    href: `#/track/${encodeURIComponent(row.track)}`,
    reference: row.track,
    disabled: !!row.error,
  };
}
