import { expect, it } from "vitest";
import { equalizerHeights } from "./equalizer";
it("follows the same four FlacCompagnon smoothing rates and 3–12 pixel range", () => {
  const next = equalizerHeights([0, 0, 0, 0], 1);
  expect(next).toEqual([0.14, 0.45, 0.24, 0.56]);
  expect(equalizerHeights(next, 0)[1]).toBeCloseTo(0.2475);
});
