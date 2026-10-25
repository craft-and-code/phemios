import type { NavigationHost } from "./history";

/** Isolated history and viewport for navigation policy regressions. */
export function navigationTestHost(hash = "#/artists", deferred = false, deferredBack = false) {
  const entries = [{ hash, state: {} as unknown }];
  const traversals: (() => void)[] = [];
  const pending: (() => void)[] = [],
    restored: number[] = [];
  let index = 0,
    top = 0,
    listener = () => {};
  const host: NavigationHost = {
    current: () => entries[index]!,
    push: (hash, state) => {
      entries.splice(++index);
      entries.push({ hash, state });
    },
    replace: (state) => {
      entries[index]!.state = state;
    },
    back: () => {
      const destination = index - 1;
      const complete = () => {
        index = destination;
        listener();
      };
      if (deferredBack) traversals.push(complete);
      else complete();
    },
    top: () => top,
    restore: (value) => {
      top = value;
      restored.push(value);
    },
    defer: (fn) => {
      if (deferred) pending.push(fn);
      else fn();
    },
    listen: (fn) => {
      listener = fn;
      return () => {
        listener = () => {};
      };
    },
  };
  return {
    host,
    restored,
    setTop: (value: number) => {
      top = value;
    },
    top: () => top,
    flushBack: () => {
      for (const run of traversals.splice(0)) run();
    },
    flush: () => {
      for (const run of pending.splice(0)) run();
    },
  };
}
