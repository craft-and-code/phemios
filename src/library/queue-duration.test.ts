import { expect, it } from "vitest";
import { queueDuration } from "./queue-duration";
it("counts repeated occurrences and leaves unavailable durations explicit", () => {
  const times = new Map<string, number | null>([
    ["track:a", 60000],
    ["track:b", null],
  ]);
  expect(queueDuration([], times)).toEqual({ milliseconds: 0, unknown: 0 });
  expect(queueDuration([{ reference: "track:a" }, { reference: "track:a" }], times)).toEqual({
    milliseconds: 120000,
    unknown: 0,
  });
  expect(
    queueDuration(
      [{ reference: "track:a" }, { reference: "track:b" }, { reference: "track:c" }],
      times,
    ),
  ).toEqual({ milliseconds: 60000, unknown: 2 });
});
