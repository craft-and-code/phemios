import type { Route } from "./routes";
/** Buffering belongs to an accepted stream: pause it rather than starting another queue. */
export function playbackToggleAction(status: string): "pause" | "resume" | "start" {
  return status === "playing" || status === "connecting"
    ? "pause"
    : status === "paused"
      ? "resume"
      : "start";
}
/** A detail selection wins; Cover Flow's front album precedes other visible Play controls. */
export function contextualReference(
  detail: string,
  rows: readonly { reference: string; disabled: boolean; central: boolean; visible: boolean }[],
): string {
  if (detail) return detail;
  const available = rows.filter((row) => row.visible && !row.disabled && row.reference);
  return (available.find((row) => row.central) ?? available[0])?.reference ?? "";
}
/** Repeat belongs to an active local transport, never just an authenticated library. */
export function repeatDisabled(
  status: string,
  busy: boolean,
  ready: boolean,
  external: boolean,
): boolean {
  return busy || !ready || external || !["playing", "paused"].includes(status);
}

/** A prepared playlist must be launchable even while an external stream owns the other views. */
export function footerTransport(input: {
  queueView: boolean;
  queued: boolean;
  podcast: boolean;
  radio: boolean;
}): "catalog" | "podcast" | "radio" {
  if (input.queueView && input.queued) return "catalog";
  return input.podcast ? "podcast" : input.radio ? "radio" : "catalog";
}

/** Detail routes retain their origin menu; only the actual workspace owns prepared-list controls. */
export function isQueueWorkspace(route: Route): boolean {
  return route.kind === "section" && route.section === "playlists";
}
