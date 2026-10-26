import { referenceSource } from "./sources";
import type { MissingAlbum } from "./missing";
import type { AccountSession } from "./server";
/** One source queue deduplicates cards and discographies and discards stale account replies. */
export function createMissingCoverLoader(
  sessionFor: (artist: string) => AccountSession | undefined,
  supported: (artist: string) => boolean,
  request: (artist: string, group: string, download: boolean) => Promise<ArrayBuffer>,
  changed: () => void,
) {
  type Entry = {
    session: AccountSession;
    promise: Promise<void>;
    url?: string;
    error?: string;
    finished?: boolean;
    cancelled?: boolean;
  };
  const entries = new Map<string, Entry>();
  const tails = { local: Promise.resolve(), server: Promise.resolve() };
  const key = (row: MissingAlbum) => `${row.artist}:${row.release_group}`;
  function forget(id: string) {
    const held = entries.get(id);
    if (held?.url) URL.revokeObjectURL(held.url);
    entries.delete(id);
  }
  return {
    status: (
      row: MissingAlbum,
    ): "idle" | "loading" | "ready" | "absent" | "failed" | "unsupported" | "cancelled" => {
      if (!supported(row.artist)) return "unsupported";
      const held = entries.get(key(row));
      if (held?.session !== sessionFor(row.artist) || !held) return "idle";
      if (held.cancelled) return "cancelled";
      return held.url ? "ready" : held.error ? "failed" : held.finished ? "absent" : "loading";
    },
    image: (row: MissingAlbum) => {
      const held = entries.get(key(row));
      return held?.session === sessionFor(row.artist) ? held?.url : undefined;
    },
    error: (row: MissingAlbum) => {
      const held = entries.get(key(row));
      return held?.session === sessionFor(row.artist) ? held?.error : undefined;
    },
    load: (row: MissingAlbum, retry = false) => {
      const session = sessionFor(row.artist),
        id = key(row),
        held = entries.get(id);
      if (!session || !supported(row.artist)) return Promise.resolve();
      if (held?.session === session && (!held.finished || (!retry && !held.error)))
        return held.promise;
      forget(id);
      const source = referenceSource(row.artist);
      const entry: Entry = { session, promise: Promise.resolve() };
      entries.set(id, entry);
      entry.promise = tails[source].then(async () => {
        if (sessionFor(row.artist) !== session || entries.get(id) !== entry) return;
        try {
          const bytes = await request(
            row.artist,
            row.release_group,
            session.account.role !== "auditor",
          );
          if (sessionFor(row.artist) !== session || entries.get(id) !== entry || !bytes.byteLength)
            return;
          const data = new Uint8Array(bytes);
          entry.url = URL.createObjectURL(
            new Blob([data.buffer], { type: data[0] === 0x89 ? "image/png" : "image/jpeg" }),
          );
        } catch (failure) {
          if (entries.get(id) === entry)
            entry.error = failure instanceof Error ? failure.message : String(failure);
        } finally {
          entry.finished = true;
          changed();
        }
      });
      changed();
      tails[source] = entry.promise;
      return entry.promise;
    },
    cancel: (rows: readonly MissingAlbum[]) => {
      for (const row of rows) {
        const id = key(row),
          entry = entries.get(id);
        if (entry && !entry.finished)
          entries.set(id, {
            session: entry.session,
            promise: Promise.resolve(),
            finished: true,
            cancelled: true,
          });
      }
      changed();
    },
    prune: () => {
      for (const [id, entry] of entries) {
        const artist = id.slice(0, id.lastIndexOf(":"));
        if (entry.session !== sessionFor(artist)) forget(id);
      }
      changed();
    },
    dispose: () => {
      for (const id of entries.keys()) forget(id);
    },
  };
}
