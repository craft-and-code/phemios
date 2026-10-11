import { expect, it } from "vitest";
import { createCoverMotion, coverWindow } from "./cover-motion";
it("travels through intermediate covers on a distant click and retargets from the visible pose", () => {
  let frame: ((time: number) => void) | undefined;
  const positions: number[] = [];
  const motion = createCoverMotion((value) => positions.push(value), {
    request: (fn) => {
      frame = (time) => {
        frame = undefined;
        fn(time);
      };
      return 1;
    },
    cancel: () => {
      frame = undefined;
    },
    now: () => 0,
  });
  motion.reset(6);
  motion.move(10);
  frame?.(200);
  const halfway = positions.at(-1)!;
  expect(halfway).toBeGreaterThan(6);
  expect(halfway).toBeLessThan(10);
  expect(coverWindow(halfway, 30)).toContain(6);
  motion.move(3);
  expect(positions.at(-1)).toBe(halfway);
  frame?.(1000);
  expect(positions.at(-1)).toBe(3);
  motion.dispose();
  expect(frame).toBeUndefined();
});
it("keeps a bounded window along either direction and clips it at catalog edges", () => {
  expect(coverWindow(0, 100)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(coverWindow(99, 100)).toEqual([94, 95, 96, 97, 98, 99]);
  expect(coverWindow(8.5, 100)).toContain(4);
  expect(coverWindow(8.5, 100)).toContain(13);
  expect(coverWindow(8000.5, 10000).length).toBeLessThanOrEqual(12);
  expect(coverWindow(0, 0)).toEqual([]);
});
it("cancels an unfinished transition when sorting or leaving the view", () => {
  let frame: ((time: number) => void) | undefined;
  const positions: number[] = [];
  const motion = createCoverMotion((value) => positions.push(value), {
    request: (fn) => {
      frame = (time) => {
        frame = undefined;
        fn(time);
      };
      return 1;
    },
    cancel: () => {
      frame = undefined;
    },
    now: () => 0,
  });
  motion.move(4);
  motion.reset(0);
  expect(frame).toBeUndefined();
  expect(positions.at(-1)).toBe(0);
  motion.move(8);
  motion.dispose();
  expect(frame).toBeUndefined();
});
