import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
interface Options<T> {
  session: (source: SourceId) => AccountSession | undefined;
  read: (source: SourceId) => Promise<T | null>;
  publish: (source: SourceId, value: T) => void;
  failed: (failure: unknown) => void;
}
/** One startup cache per source cannot replace a subsequently engaged/synchronized projection.
 * Native IPC may finish after login, sync or disposal. Source revisions and exact session
 * objects guard data, errors and automatic startup; the other source stays independent.
 * Publishers retain responsibility for validating the admitted projection's schema.
 */
export function createCatalogBootstrap<T>(options: Options<T>) {
  const revisions: Record<SourceId, number> = { local: 0, server: 0 },
    requested: Record<SourceId, boolean> = { local: false, server: false };
  let disposed = false;
  const unused = (source: SourceId) => !disposed && revisions[source] === 0;
  function guard(source: SourceId) {
    const revision = revisions[source],
      owner = options.session(source);
    return () => !disposed && revisions[source] === revision && options.session(source) === owner;
  }
  return {
    /** Native identity is process-only and may outlive a frontend reload; never restore over an explicit action. */
    async restoreSession(
      source: SourceId,
      read: (source: SourceId) => Promise<AccountSession | undefined>,
      publish: (source: SourceId, session: AccountSession) => void,
    ): Promise<boolean> {
      if (!unused(source)) return false;
      const current = guard(source);
      try {
        const value = await read(source);
        if (!current() || !value) return false;
        publish(source, value);
        return true;
      } catch (failure) {
        if (current()) options.failed(failure);
        return false;
      }
    },
    async load(source: SourceId): Promise<boolean> {
      if (!unused(source) || requested[source]) return false;
      requested[source] = true;
      const current = guard(source);
      try {
        const value = await options.read(source);
        if (!current()) return false;
        if (value !== null) {
          options.publish(source, value);
          return true;
        }
      } catch (failure) {
        if (current()) options.failed(failure);
      }
      return false;
    },
    invalidate(source: SourceId) {
      revisions[source]++;
    },
    capture(source: SourceId) {
      revisions[source]++;
      return guard(source);
    },
    unused,
    active: () => !disposed,
    dispose() {
      disposed = true;
      revisions.local++;
      revisions.server++;
    },
  };
}
