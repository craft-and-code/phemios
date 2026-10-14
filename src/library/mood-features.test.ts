import { expect, it } from "vitest";
import { validFeatureProgress } from "./mood-features";
it("refuses invented progress and preserves legacy task replies", () => {
  const row = { phase: "analyzing", done: 3, total: 5, analyzed: 1, reused: 1, failed: 1 };
  expect(validFeatureProgress(undefined)).toBe(true);
  expect(validFeatureProgress(row)).toBe(true);
  for (const invalid of [
    { ...row, total: 2 },
    { ...row, failed: 0 },
    { ...row, done: NaN },
    { ...row, phase: "fake" },
    { ...row, total: 16385 },
  ])
    expect(validFeatureProgress(invalid)).toBe(false);
});
