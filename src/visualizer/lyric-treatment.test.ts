import { expect, it } from "vitest";
import { lyricTreatment, lyricAct } from "./lyric-treatment";
it("retains words in order with bounded visual chunks and deterministic cue typography", () => {
  const text = "These original fixture words float freely over the imaginary sea";
  const value = lyricTreatment(text, 1000);
  expect(value.chunks.map((chunk) => chunk.text).join(" ")).toBe(text);
  expect(value.chunks.length).toBeLessThanOrEqual(4);
  expect(lyricTreatment(text, 1000)).toEqual(value);
  expect(lyricTreatment(text, 2000)).not.toEqual(value);
  expect(lyricTreatment("word ".repeat(200), 0).chunks.length).toBeLessThanOrEqual(4);
});
it("offers four typography families, several sizes and marked orientations in both directions", () => {
  const values = Array.from({ length: 40 }, (_, cue) =>
    lyricTreatment("Original fixture phrase", cue, { track: `track:${cue}`, phase: 0 }),
  );
  expect(new Set(values.map((value) => value.font)).size).toBe(4);
  expect(new Set(values.map((value) => value.angle)).size).toBeGreaterThan(10);
  expect(values.some((value) => value.angle < 0)).toBe(true);
  expect(values.some((value) => value.angle > 0)).toBe(true);
  expect(values.every((value) => Math.abs(value.angle) >= 45 && Math.abs(value.angle) <= 79)).toBe(
    true,
  );
  expect(new Set(values.map((value) => value.size)).size).toBe(4);
});

it("keeps a track font for each act and changes it at most twice across supplied cues", () => {
  const values = Array.from({ length: 60 }, (_, index) =>
    lyricTreatment(`Original cue ${index}`, index, {
      track: "track:fixture",
      phase: Math.min(2, Math.floor(index / 20)),
    }),
  );
  const changes = values.slice(1).filter((value, index) => value.font !== values[index]!.font);
  expect(changes).toHaveLength(2);
  expect(new Set(values.slice(0, 20).map((value) => value.font)).size).toBe(1);
});
it("groups punctuation and avoids isolating short joining words while retaining supplied words", () => {
  const text = "We cross the sea, and carry the light into the night";
  const value = lyricTreatment(text, 100);
  expect(value.chunks.map((chunk) => chunk.text).join(" ")).toBe(text);
  expect(value.chunks.length).toBeLessThanOrEqual(4);
  expect(value.chunks.some((chunk) => chunk.text.endsWith("sea,"))).toBe(true);
  expect(value.chunks.every((chunk) => chunk.text.split(/\s+/).length >= 2)).toBe(true);
});

it("partitions supplied cue order into three contiguous acts and keeps unknown data stable", () => {
  expect(Array.from({ length: 9 }, (_, index) => lyricAct(index, 9))).toEqual([
    0, 0, 0, 1, 1, 1, 2, 2, 2,
  ]);
  expect(lyricAct(0, 0)).toBe(0);
  expect(lyricAct(NaN, 4)).toBe(0);
  expect(lyricAct(99, 5)).toBe(2);
});

it("keeps complete punctuation-delimited clauses together before balancing unpunctuated words", () => {
  expect(
    lyricTreatment("A silver morning rises; the horizon opens wide", 0).chunks.map((c) => c.text),
  ).toEqual(["A silver morning rises;", "the horizon opens wide"]);
});
