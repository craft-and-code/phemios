import { expect, it } from "vitest";
import { statValueSize } from "./stat-value-fit";

it("keeps short values at normal size and fits long measurements without changing the tile", () => {
  expect(statValueSize(100, 60)).toBe(24);
  expect(statValueSize(120, 240)).toBeLessThanOrEqual(12);
  expect(statValueSize(180, 240)).toBeLessThan(18);
  expect(statValueSize(0, 240)).toBe(24);
});
