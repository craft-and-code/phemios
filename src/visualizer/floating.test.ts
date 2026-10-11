import { expect, it } from "vitest";
import { floatingObjects, animationRuns } from "./floating";
it("bounds flying objects and keeps their coordinates finite with invalid meters", () => {
  const rows = floatingObjects(3, [NaN, Infinity, -1, 9], 100000);
  expect(rows).toHaveLength(48);
  expect(rows.every((row) => Object.values(row).every(Number.isFinite))).toBe(true);
  expect(floatingObjects(3, [0, 0, 0, 0])).not.toEqual(floatingObjects(3, [1, 1, 1, 1]));
});
it("never schedules animation while disabled, paused, hidden or reduced motion", () => {
  expect(animationRuns(true, true, false, false)).toBe(true);
  for (const args of [
    [false, true, false, false],
    [true, false, false, false],
    [true, true, true, false],
    [true, true, false, true],
  ] as const)
    expect(animationRuns(args[0], args[1], args[2], args[3])).toBe(false);
});
