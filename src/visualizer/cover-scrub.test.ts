import { expect, it } from "vitest";
import { createCoverScrub, animateCoverMove } from "./cover-scrub";
it("publishes only the latest rapid slider target per frame and flushes the final target", () => {
  let frame: (() => void) | undefined,
    requests = 0;
  const shown: number[] = [];
  const scrub = createCoverScrub(
    (value) => shown.push(value),
    (fn) => {
      frame = fn;
      return ++requests;
    },
    () => {
      frame = undefined;
    },
  );
  for (let value = 0; value < 100; value++) scrub.move(value);
  expect(requests).toBe(1);
  expect(shown).toEqual([]);
  frame?.();
  expect(shown).toEqual([99]);
  scrub.move(40);
  scrub.move(70);
  scrub.finish();
  expect(shown).toEqual([99, 70]);
  expect(frame).toBeUndefined();
  scrub.move(1);
  scrub.dispose();
  expect(frame).toBeUndefined();
  expect(shown).toEqual([99, 70]);
});
it("animates adjacent moves and long jumps, including slider navigation", () => {
  expect(animateCoverMove(5, 6)).toBe(true);
  expect(animateCoverMove(6, 5)).toBe(true);
  expect(animateCoverMove(0, 50)).toBe(true);
  expect(animateCoverMove(50, 0)).toBe(true);
  expect(animateCoverMove(5, 5)).toBe(false);
});

it("drops pending targets when the album selection changes and accepts later input", () => {
  let frame: (() => void) | undefined;
  const shown: number[] = [];
  const scrub = createCoverScrub(
    (value) => shown.push(value),
    (fn) => {
      frame = fn;
      return 1;
    },
    () => {
      frame = undefined;
    },
  );
  scrub.move(90);
  scrub.cancel();
  expect(frame).toBeUndefined();
  expect(shown).toEqual([]);
  scrub.move(3);
  frame?.();
  expect(shown).toEqual([3]);
});
