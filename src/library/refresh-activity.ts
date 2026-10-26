import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js";
/** A short visual acknowledgement keeps very fast reads visible without delaying their results. */
export function createRefreshActivity(
  identity: Accessor<unknown> = () => undefined,
  busy: Accessor<boolean> = () => false,
) {
  const [visible, setVisible] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true,
    observedBusy = false;
  let controller: AbortController | undefined;
  function clear() {
    observedBusy = false;
    controller?.abort();
    clearTimeout(timer);
    setVisible(false);
    setPending(false);
  }
  createEffect(on(identity, clear, { defer: true }));
  // Once the caller owns activity, its completion also retires any obsolete returned promise.
  createEffect(() => {
    if (busy()) observedBusy = true;
    else if (observedBusy) setPending(false);
  });
  onCleanup(() => {
    alive = false;
    clear();
  });
  return {
    visible,
    pending,
    clear,
    track(signal: AbortSignal, result: unknown) {
      if (!alive || signal.aborted || controller?.signal !== signal) return;
      if (busy()) observedBusy = true;
      setPending(!observedBusy || busy());
      const finish = () => {
        if (alive && !signal.aborted && controller?.signal === signal) setPending(false);
      };
      void Promise.resolve(result).then(finish, finish);
    },
    begin() {
      clear();
      observedBusy = busy();
      controller = new AbortController();
      if (!alive) {
        controller.abort();
        return controller.signal;
      }
      setVisible(true);
      timer = setTimeout(() => setVisible(false), 1000);
      return controller.signal;
    },
  };
}
