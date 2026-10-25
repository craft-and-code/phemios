/** A viewport can grow after a route renders its asynchronous catalogue. */
export interface ScrollPositionTarget {
  maximum: () => number;
  move: (top: number) => void;
  changed: (retry: () => void) => () => void;
  interrupted: (cancel: () => void) => () => void;
  expire: (cancel: () => void) => () => void;
}

/** Restore when reachable; user input, expiry or navigation retires pending work. */
export function restorePosition(target: ScrollPositionTarget, top: number): () => void {
  const wanted = Number.isFinite(top) ? Math.max(0, Math.min(2 ** 24, top)) : 0;
  const cleanups: (() => void)[] = [];
  let active = true;
  function cancel() {
    if (!active) return;
    active = false;
    for (const cleanup of cleanups.splice(0)) cleanup();
  }
  function attempt() {
    if (!active) return;
    const maximum = Math.max(0, target.maximum());
    target.move(Math.min(wanted, maximum));
    if (maximum >= wanted) cancel();
  }
  function subscribe(start: () => () => void) {
    if (!active) return;
    const cleanup = start();
    if (active) cleanups.push(cleanup);
    else cleanup();
  }
  subscribe(() => target.changed(attempt));
  subscribe(() => target.interrupted(cancel));
  subscribe(() => target.expire(cancel));
  attempt();
  return cancel;
}

/** Observe only the viewport and its direct layout children, never every catalogue row. */
export function restoreElementPosition(element: HTMLElement, top: number): () => void {
  return restorePosition(
    {
      maximum: () => element.scrollHeight - element.clientHeight,
      move: (value) => element.scrollTo({ top: value, behavior: "instant" }),
      changed: (retry) => {
        const sizes = new ResizeObserver(retry);
        const observed = new Set<Element>();
        const observe = () => {
          for (const child of observed)
            if (child.parentElement !== element) {
              sizes.unobserve(child);
              observed.delete(child);
            }
          for (const child of element.children)
            if (!observed.has(child)) {
              observed.add(child);
              sizes.observe(child);
            }
        };
        sizes.observe(element);
        observe();
        const children = new MutationObserver(() => {
          observe();
          retry();
        });
        children.observe(element, { childList: true });
        return () => {
          sizes.disconnect();
          children.disconnect();
        };
      },
      interrupted: (cancel) => {
        const keys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
        const key = (event: KeyboardEvent) => {
          if (keys.has(event.key)) cancel();
        };
        for (const name of ["wheel", "touchstart", "pointerdown"])
          element.addEventListener(name, cancel, { passive: true });
        element.ownerDocument.addEventListener("keydown", key);
        return () => {
          for (const name of ["wheel", "touchstart", "pointerdown"])
            element.removeEventListener(name, cancel);
          element.ownerDocument.removeEventListener("keydown", key);
        };
      },
      expire: (cancel) => {
        const timer = setTimeout(cancel, 5000);
        return () => clearTimeout(timer);
      },
    },
    top,
  );
}

/** A primary nested catalogue replaces the shell viewport; auxiliary panels keep their own state. */
export function navigationViewport(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>("[data-navigation-scroll]") ?? root;
}
