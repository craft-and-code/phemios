import { expect, it } from "vitest";
import { nextChoice, createChoiceTypeahead } from "./choices";
it("wraps keyboard movement while skipping disabled entries and empty choices", () => {
  const rows = [{}, { disabled: true }, {}];
  expect(nextChoice(rows, 0, 1)).toBe(2);
  expect(nextChoice(rows, 2, 1)).toBe(0);
  expect(nextChoice(rows, 0, -1)).toBe(2);
  expect(nextChoice([], 0, 1)).toBe(-1);
  expect(nextChoice([{ disabled: true }], 0, 1)).toBe(-1);
});

it("finds accented country names from a continuous unaccented keyboard prefix", () => {
  const search = createChoiceTypeahead(() => [
    { label: "Espagne" },
    { label: "États-Unis" },
    { label: "France" },
  ]);
  expect(search.find("e", 1000, 2)).toBe(0);
  expect(search.find("t", 1100, 0)).toBe(1);
  expect(search.find("f", 2000, 1)).toBe(2);
  search.reset();
  expect(search.find("t", 2050, 2)).toBe(-1);
});
it("cycles repeated letters, skips unavailable choices and resets an expired prefix", () => {
  const search = createChoiceTypeahead(() => [
    { label: "France" },
    { label: "Finlande" },
    { label: "Fidji", disabled: true },
  ]);
  expect(search.find("f", 1000, 1)).toBe(0);
  expect(search.find("f", 1100, 0)).toBe(1);
  expect(search.find("f", 1200, 1)).toBe(0);
  expect(search.find("i", 1250, 0)).toBe(-1);
  expect(search.find("f", 3000, 1)).toBe(0);
  expect(createChoiceTypeahead(() => []).find("f", 0, 0)).toBe(-1);
});
