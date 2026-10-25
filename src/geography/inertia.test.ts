import { expect, it } from "vitest";
import { createGlobeInertia, flingVelocity } from "./inertia";
import type { Point } from "./projection";
function fixture() {
  let center: Point = [170, 79],
    time = 0,
    allowed = true,
    next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const motion = createGlobeInertia({
    read: () => center,
    write: (value) => {
      center = value;
    },
    now: () => time,
    enabled: () => allowed,
    request: (callback) => {
      frames.set(++next, callback);
      return next;
    },
    cancel: (id) => {
      frames.delete(id);
    },
  });
  return {
    motion,
    frames,
    center: () => center,
    disable: () => {
      allowed = false;
    },
    tick(dt: number) {
      time += dt;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(time));
    },
  };
}
it("uses recent gesture speed and ignores a held or stationary release", () => {
  expect(
    flingVelocity(
      [
        { x: 0, y: 0, time: 0 },
        { x: 100, y: 0, time: 50 },
      ],
      55,
      1,
    )[0],
  ).toBeCloseTo(-0.9);
  expect(
    flingVelocity(
      [
        { x: 0, y: 0, time: 0 },
        { x: 50, y: 0, time: 50 },
      ],
      55,
      1,
    )[0],
  ).toBeCloseTo(-0.45);
  expect(
    flingVelocity(
      [
        { x: 0, y: 0, time: 0 },
        { x: 50, y: 0, time: 50 },
      ],
      170,
      1,
    ),
  ).toEqual([0, 0]);
  expect(flingVelocity([{ x: 5, y: 3, time: 10 }], 10, 1)).toEqual([0, 0]);
});
it("decays to idle with wrapped longitude and bounded latitude", () => {
  const f = fixture();
  f.motion.start([0.5, 0.2]);
  for (let i = 0; i < 200; i++) f.tick(16);
  expect(f.frames.size).toBe(0);
  expect(f.center()[0]).toBeGreaterThanOrEqual(-180);
  expect(f.center()[0]).toBeLessThan(180);
  expect(f.center()[1]).toBe(80);
});
it("integrates the same physical distance at different refresh rates", () => {
  const a = fixture(),
    b = fixture();
  a.motion.start([0.5, 0]);
  b.motion.start([0.5, 0]);
  for (let i = 0; i < 30; i++) a.tick(16);
  for (let i = 0; i < 15; i++) b.tick(32);
  expect(a.center()[0]).toBeCloseTo(b.center()[0], 8);
});
it("cancels queued motion and honors reduced motion/hidden pages", () => {
  const f = fixture();
  f.motion.start([0.5, 0]);
  f.motion.stop();
  const center = f.center();
  f.tick(16);
  expect(f.center()).toEqual(center);
  expect(f.frames.size).toBe(0);
  f.motion.start([0.5, 0]);
  f.disable();
  f.tick(16);
  expect(f.center()).toEqual(center);
  expect(f.frames.size).toBe(0);
  f.motion.start([0.5, 0]);
  expect(f.frames.size).toBe(0);
});

it("retires an already dequeued frame before a replacement gesture", () => {
  const f = fixture();
  f.motion.start([0.5, 0]);
  const late = [...f.frames.values()][0]!;
  f.motion.stop();
  f.motion.start([-0.2, 0]);
  const center = f.center();
  late(16);
  expect(f.center()).toEqual(center);
  expect(f.frames.size).toBe(1);
  f.tick(16);
  expect(f.center()[0]).toBeLessThan(center[0]);
});
it("does not resume an old fling after a long suspended frame", () => {
  const f = fixture();
  f.motion.start([0.5, 0]);
  const center = f.center();
  f.tick(500);
  expect(f.center()).toEqual(center);
  expect(f.frames.size).toBe(0);
});
