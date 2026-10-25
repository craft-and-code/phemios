import { afterEach, expect, it, vi } from "vitest";
import { createBrowserGlobeInertia } from "./inertia";
import type { Point } from "./projection";
afterEach(() => vi.unstubAllGlobals());
it("keeps WebKit's Window receiver when a new gesture cancels active inertia", () => {
  let next = 0,
    center: Point = [0, 0];
  const frames = new Map<number, FrameRequestCallback>();
  const host = {
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(this: unknown, callback: FrameRequestCallback) {
      if (this !== host)
        throw TypeError("Can only call Window.requestAnimationFrame on instances of Window");
      frames.set(++next, callback);
      return next;
    },
    cancelAnimationFrame(this: unknown, id: number) {
      if (this !== host)
        throw TypeError("Can only call Window.cancelAnimationFrame on instances of Window");
      frames.delete(id);
    },
  };
  vi.stubGlobal("window", host);
  vi.stubGlobal("document", { hidden: false });
  const motion = createBrowserGlobeInertia(
    () => center,
    (value) => {
      center = value;
    },
  );
  motion.start([0.5, 0]);
  expect(frames.size).toBe(1);
  expect(() => motion.start([-0.5, 0])).not.toThrow();
  expect(frames.size).toBe(1);
  expect(() => motion.stop()).not.toThrow();
  expect(frames.size).toBe(0);
  expect(() => motion.start([0.2, 0])).not.toThrow();
  expect(frames.size).toBe(1);
  motion.stop();
});
