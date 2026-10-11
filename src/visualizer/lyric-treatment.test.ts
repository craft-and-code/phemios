import { expect, it } from "vitest";
import { lyricTreatment } from "./lyric-treatment";
it("retains words in order with bounded visual chunks and deterministic cue typography", () => {
  const text = "These original fixture words float freely over the imaginary sea";
  const value = lyricTreatment(text, 1000);
  expect(value.chunks.map((chunk) => chunk.text).join(" ")).toBe(text);
  expect(value.chunks.length).toBeLessThanOrEqual(6);
  expect(lyricTreatment(text, 1000)).toEqual(value);
  expect(lyricTreatment(text, 2000)).not.toEqual(value);
  expect(lyricTreatment("word ".repeat(200), 0).chunks.length).toBeLessThanOrEqual(6);
});
it("offers four typography families, several sizes and marked orientations in both directions", () => {
  const values = Array.from({ length: 40 }, (_, cue) =>
    lyricTreatment("Original fixture phrase", cue),
  );
  expect(new Set(values.map((value) => value.font)).size).toBe(4);
  expect(new Set(values.map((value) => value.angle)).size).toBeGreaterThan(10);
  expect(values.some((value) => value.angle < 0)).toBe(true);
  expect(values.some((value) => value.angle > 0)).toBe(true);
  expect(values.every((value) => Math.abs(value.angle) >= 45 && Math.abs(value.angle) <= 79)).toBe(
    true,
  );
  expect(new Set(values.flatMap((value) => value.chunks.map((chunk) => chunk.size))).size).toBe(4);
});
