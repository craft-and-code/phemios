import { expect, it } from "vitest";
import { concertConfig } from "./config";
it("admits consistent retained counters, including an exhausted budget", () => {
  expect(
    concertConfig({ ready: true, limit: 1000, used: 1000, remaining: 0, resetAt: 1800000000 })
      .remaining,
  ).toBe(0);
});
it("refuses absent, unbounded or inconsistent native budget projections", () => {
  for (const raw of [
    null,
    {},
    { ready: true, limit: 1001, used: 0, remaining: 1001, resetAt: null },
    { ready: true, limit: 1000, used: 1000, remaining: 1, resetAt: null },
    { ready: true, limit: 1000, used: -1, remaining: 1001, resetAt: null },
  ])
    expect(() => concertConfig(raw)).toThrow();
});
