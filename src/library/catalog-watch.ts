import { createEffect, onCleanup } from "solid-js";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";

/** New engines publish an opaque revision; older engines retain date/count detection. */
function marker(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid catalogue marker");
  const row = value as Record<string, unknown>;
  if (row.catalog_revision !== undefined) {
    if (typeof row.catalog_revision !== "string" || !/^\d{1,20}$/.test(row.catalog_revision))
      throw Error("Invalid catalogue revision");
    return row.catalog_revision;
  }
  const fields = [row.scanned_at, row.files, row.artists, row.releases, row.recordings, row.tracks];
  if (
    !Number.isSafeInteger(row.scanned_at) ||
    Number(row.scanned_at) < 0 ||
    fields.some(
      (value) => value !== undefined && (!Number.isSafeInteger(value) || Number(value) < 0),
    )
  )
    throw Error("Invalid catalogue date or counts");
  return JSON.stringify(fields);
}

/** Poll only connected authorities; publication changes reload data without remounting views.
 * One pending probe per source, exact-login admission and disposal discard late replies.
 * Failed probes retain the cache; the existing connection monitor owns connectivity feedback.
 */
export function createCatalogWatch(options: {
  session: (source: SourceId) => AccountSession | undefined;
  busy: () => boolean;
  read: (source: SourceId, owner: AccountSession) => Promise<unknown>;
  refresh: (source: SourceId) => Promise<boolean>;
}) {
  for (const source of ["local", "server"] as const)
    createEffect(() => {
      const owner = options.session(source);
      if (!owner) return;
      let disposed = false,
        confirmed: string | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const current = () => !disposed && options.session(source) === owner;
      const schedule = () => {
        if (current()) timer = setTimeout(() => void poll(), 5000);
      };
      async function poll() {
        timer = undefined;
        try {
          if (!current() || options.busy()) return;
          const next = marker(await options.read(source, owner!));
          if (!current() || options.busy() || next === confirmed) return;
          // The first probe refreshes too: a publication may have changed since login's snapshot.
          if (await options.refresh(source)) {
            if (current()) confirmed = next;
          }
        } catch {
          // Never acknowledge a failed refresh: retry the same revision on the next probe.
        } finally {
          schedule();
        }
      }
      schedule();
      onCleanup(() => {
        disposed = true;
        clearTimeout(timer);
      });
    });
}
