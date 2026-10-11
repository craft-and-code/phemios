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
