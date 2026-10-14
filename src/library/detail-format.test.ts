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
