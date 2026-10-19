/** Serial resident-art recovery for visible legacy cards; a scope is one source session/snapshot. */
export function createArtistLogoRecovery(options: {
  enabled: () => boolean;
  scope: (reference: string) => object | undefined;
  cached: (reference: string) => boolean;
  load: (reference: string) => Promise<void>;
  failed: (failure: unknown) => void;
}) {
  const visible = new Set<string>(),
    queued = new Map<string, object>(),
    attempted = new Map<string, object>();
  let disposed = false,
    running = false;
  async function pump() {
    if (running || disposed) return;
    running = true;
    try {
      while (!disposed && queued.size) {
        const [reference, scope] = queued.entries().next().value!;
        queued.delete(reference);
        if (
          !options.enabled() ||
          !visible.has(reference) ||
          options.scope(reference) !== scope ||
          options.cached(reference)
        )
          continue;
        attempted.set(reference, scope);
        try {
          await options.load(reference);
        } catch (failure) {
          if (!disposed && options.scope(reference) === scope && visible.has(reference))
            options.failed(failure);
        }
      }
    } finally {
      running = false;
    }
  }
  function refresh() {
    if (disposed) return;
    for (const reference of visible) {
      const scope = options.scope(reference);
      if (
        options.enabled() &&
        scope &&
        !options.cached(reference) &&
        attempted.get(reference) !== scope
      )
        queued.set(reference, scope);
      else queued.delete(reference);
    }
    void pump();
  }
  return {
    refresh,
    visibility(reference: string, active: boolean) {
      if (active) visible.add(reference);
      else {
        visible.delete(reference);
        queued.delete(reference);
        attempted.delete(reference);
      }
      refresh();
    },
    dispose() {
      disposed = true;
      visible.clear();
      queued.clear();
      attempted.clear();
    },
  };
}
