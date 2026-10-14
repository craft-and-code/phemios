import { expect, it, vi } from "vitest";
import { createViewportGate } from "./viewport-gate";
it("shares one observer and retires offscreen scenes and disposed targets", () => {
  const observe = vi.fn(),
    unobserve = vi.fn(),
    disconnect = vi.fn();
  let callback!: IntersectionObserverCallback;
  const construct = vi.fn(function (this: unknown, next: IntersectionObserverCallback) {
    callback = next;
    return { observe, unobserve, disconnect };
  });
  vi.stubGlobal("IntersectionObserver", construct);
  const gate = createViewportGate(),
    first = {} as Element,
    second = {} as Element,
    show = vi.fn();
  const stop = gate.watch(first, show);
  gate.watch(second, vi.fn());
  expect(construct).toHaveBeenCalledTimes(1);
  callback(
    [
      { target: first, isIntersecting: true },
      { target: first, isIntersecting: false },
    ] as IntersectionObserverEntry[],
    {} as IntersectionObserver,
  );
  expect(show.mock.calls).toEqual([[true], [false]]);
  stop();
  callback(
    [{ target: first, isIntersecting: true }] as IntersectionObserverEntry[],
    {} as IntersectionObserver,
  );
  expect(show).toHaveBeenCalledTimes(2);
  expect(unobserve).toHaveBeenCalledWith(first);
  gate.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
