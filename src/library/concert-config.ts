/** Admit an explicit native key-removal attempt from the retained configuration status. */
export function canRemoveConcertKey(
  native: boolean,
  busy: boolean,
  status: { ready: boolean; error?: string } | undefined,
): boolean {
  return native && !busy && (status?.ready === true || !!status?.error);
}
