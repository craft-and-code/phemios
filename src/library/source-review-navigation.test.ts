import { expect, it } from "vitest";
import { hasSourceReviewPages } from "./source-review";
it("keeps the previous-page control reachable after reviewing the last pending item of the final page", () => {
  const before = { offset: 20, limit: 20, total: 21 };
  expect(hasSourceReviewPages(before)).toBe(true);
  // Accepting/refusing the only item on page two leaves twenty pending items on page one.
  expect(hasSourceReviewPages({ ...before, total: 20 })).toBe(true);
  // Another administrator may empty the remaining queue before our refresh.
  expect(hasSourceReviewPages({ ...before, total: 0 })).toBe(true);
  expect(hasSourceReviewPages({ offset: 0, limit: 20, total: 20 })).toBe(false);
  expect(hasSourceReviewPages({ offset: 0, limit: 20, total: 0 })).toBe(false);
});
