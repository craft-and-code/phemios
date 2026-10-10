import { expect, it } from "vitest";
import { nextChoice } from "./choices";
it("wraps keyboard movement while skipping disabled entries and empty choices", () => {
  const rows = [{}, { disabled: true }, {}];
  expect(nextChoice(rows, 0, 1)).toBe(2);
  expect(nextChoice(rows, 2, 1)).toBe(0);
  expect(nextChoice(rows, 0, -1)).toBe(2);
  expect(nextChoice([], 0, 1)).toBe(-1);
  expect(nextChoice([{ disabled: true }], 0, 1)).toBe(-1);
});
