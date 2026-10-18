import { expect, it } from "vitest";
import { fileSize, trackDuration, collectionDuration } from "./detail-format";
it("formats exact file facts in decimal sizes and rounded track clocks", () => {
  expect(fileSize(32_300_000)).toBe("32,3 Mo");
  expect(fileSize(573_000)).toBe("573 Ko");
  expect(fileSize(0)).toBe("0 o");
  expect(trackDuration(125_600)).toBe("2:06");
  expect(trackDuration(3_600_000)).toBe("60:00");
  expect(trackDuration(null)).toBe("Inconnue");
});

it("leaves unknown collection duration blank without hiding a confirmed zero", () => {
  for (const value of [undefined, null, -1, 0.5, NaN, Infinity])
    expect(collectionDuration(value)).toBe("");
  expect(collectionDuration(0)).toBe("0:00");
  expect(collectionDuration(125600)).toBe("2:05");
});

it("shows hours in long collection and album totals", () => {
  expect(collectionDuration((812 * 60 + 17) * 1000)).toBe("13:32:17");
  expect(collectionDuration(3_600_000)).toBe("1:00:00");
  expect(collectionDuration(86_400_000)).toBe("24:00:00");
});
