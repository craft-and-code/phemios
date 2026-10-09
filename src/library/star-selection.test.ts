import { expect, it } from "vitest";
import { nextStarSelection } from "./star-selection";
it("clears repeated personal ratings while keeping a valid minimum for rated albums", () => {
  expect(nextStarSelection(4, 4)).toBeNull();
  expect(nextStarSelection(null, 4)).toBe(4);
  expect(nextStarSelection(4, 4, 1)).toBe(1);
  expect(nextStarSelection(1, 1, 1)).toBe(1);
  expect(nextStarSelection(4, 5, 1)).toBe(5);
});
