import { expect, it } from "vitest";
import { parseLyrics, activeLyricTime } from "./lyrics";
it("retains untimed and blank cues and follows seek/pause clock without guessed timing", () => {
  const value = parseLyrics(
    {
      track: "track:one",
      lyrics: {
        source: "lrc",
        synced: true,
        lines: [
          { at_ms: null, text: "Untimed" },
          { at_ms: 1000, text: "Words" },
          { at_ms: 2000, text: "" },
          { at_ms: 1000, text: "Same cue" },
        ],
      },
    },
    "track:one",
  );
  expect(activeLyricTime(value, 500)).toBeNull();
  expect(activeLyricTime(value, 1000)).toBe(1000);
  expect(activeLyricTime(value, 2500)).toBe(2000);
  expect(activeLyricTime(value, 1200)).toBe(1000);
  expect(() => parseLyrics({ track: "track:other", lyrics: null }, "track:one")).toThrow();
});
