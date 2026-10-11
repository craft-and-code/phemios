import { expect, it } from "vitest";
import { coverOpacity, draggedCover, coverDragTarget } from "./cover-flow-policy";
it("keeps inner artwork opaque and fades the two outer neighbours symmetrically", () => {
  for (const sign of [-1, 1]) {
    expect([0, 1, 2].map((d) => coverOpacity(d * sign))).toEqual([1, 1, 1]);
    expect(coverOpacity(3 * sign)).toBe(0.55);
    expect(coverOpacity(4 * sign)).toBe(0.2);
  }
});
it("drags in the displayed order and stops at both edges", () => {
  expect(draggedCover(5, -180, 20)).toBe(7);
  expect(draggedCover(1, 270, 20)).toBe(0);
  expect(draggedCover(19, -180, 20)).toBe(19);
});

it("does not capture a side-cover tap, but still recognizes a real drag", () => {
  expect(coverDragTarget(4, 0, 12)).toBeUndefined();
  expect(coverDragTarget(4, 5, 12)).toBeUndefined();
  expect(coverDragTarget(4, 180, 12)).toBe(2);
});
