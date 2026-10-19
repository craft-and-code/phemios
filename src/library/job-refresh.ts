import type { SourceId } from "./sources";
/** Serialize catalog refreshes outside task polling, with at most one queued read per source.
 * Captured owners guard queued work; later completions get a fresh read after the active one.
 */
export function createJobRefresh(changed: (source: SourceId) => Promise<void>) {
  interface Entry {
    current: () => boolean;
    done: Promise<void>;
    resolve: () => void;
    reject: (failure: unknown) => void;
  }
  const pending = new Map<SourceId, Entry>();
  let running = false,
    disposed = false;
  async function drain() {
    if (running || disposed) return;
    running = true;
    try {
      while (!disposed && pending.size) {
        const next = pending.entries().next().value;
        if (!next) break;
        const [source, entry] = next;
        pending.delete(source);
        try {
          if (entry.current()) await changed(source);
          entry.resolve();
        } catch (failure) {
          entry.reject(failure);
        }
      }
    } finally {
      running = false;
    }
  }
  return {
    request(source: SourceId, current: () => boolean): Promise<void> {
      if (disposed || !current()) return Promise.resolve();
      const held = pending.get(source);
      if (held?.current()) return held.done;
      held?.resolve();
      let resolve!: () => void, reject!: (failure: unknown) => void;
      const done = new Promise<void>((accept, refuse) => {
        resolve = accept;
        reject = refuse;
      });
      pending.set(source, { current, done, resolve, reject });
      void drain();
      return done;
    },
    dispose() {
      disposed = true;
      for (const entry of pending.values()) entry.resolve();
      pending.clear();
    },
  };
}
