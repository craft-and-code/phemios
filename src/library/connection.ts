/** Probe only an explicitly opened session; stop ignores late answers and cancels polling. */
export function connectionMonitor(probe: () => Promise<void>, changed: (online: boolean) => void) {
  let epoch = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  function schedule(generation: number) {
    timer = setTimeout(async () => {
      timer = undefined;
      let online = false;
      try {
        await probe();
        online = true;
      } catch {
        // Connectivity is shown separately from data errors; keep existing drafts and cache.
      }
      if (generation !== epoch) return;
      changed(online);
      schedule(generation);
    }, 15000);
  }
  return {
    start() {
      if (timer !== undefined) clearTimeout(timer);
      changed(true);
      schedule(++epoch);
    },
    stop() {
      epoch++;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      changed(false);
    },
  };
}
