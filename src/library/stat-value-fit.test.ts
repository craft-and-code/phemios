import { expect, it } from "vitest";
import { statValueSize } from "./stat-value-fit";

it("keeps short values at normal size and fits long measurements without changing the tile", () => {
  expect(statValueSize(100, 60)).toBe(24);
  expect(statValueSize(120, 240)).toBeLessThanOrEqual(12);
  expect(statValueSize(180, 240)).toBeLessThan(18);
  expect(statValueSize(0, 240)).toBe(24);
});

it("reserves breathing room for long localized day-hour-minute values", () => {
  expect(statValueSize(180, 175)).toBeLessThan(24);
  expect((175 * statValueSize(180, 175)) / 24).toBeLessThanOrEqual(168);
  expect(statValueSize(180, 180)).toBeLessThan(24);
});
