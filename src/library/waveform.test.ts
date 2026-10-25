import { expect, it } from "vitest";
import { parseWaveform, waveformPath, waveformPosition } from "./waveform";
it("keeps exact decoded bucket positions and refuses a misleading incomplete envelope", () => {
  const raw = {
    reference: "track:one",
    duration_ms: 1000,
    sample_rate: 8000,
    bucket_frames: 4000,
    peaks: [0, 0.75],
  };
  const value = parseWaveform(raw, "track:one");
  expect(waveformPath(value)).toContain("M500.00 6.50V33.50");
  expect(() => parseWaveform({ ...raw, peaks: [0.75] }, "track:one")).toThrow();
  expect(() => parseWaveform({ ...raw, reference: "track:two" }, "track:one")).toThrow();
  expect(() => parseWaveform({ ...raw, peaks: [NaN, 0] }, "track:one")).toThrow();
});

it("maps pointer positions to the drawn timeline, independent of the range thumb", () => {
  expect(waveformPosition(250, 100, 600, 240000)).toBe(60000);
  expect(waveformPosition(100, 100, 600, 240000)).toBe(0);
  expect(waveformPosition(700, 100, 600, 240000)).toBe(240000);
  expect(waveformPosition(900, 100, 600, 240000)).toBe(240000);
  expect(waveformPosition(0, 100, 0, 240000)).toBe(0);
});

it("leaves unread CD buckets empty rather than drawing invented silence", () => {
  expect(
    waveformPath({
      reference: "track:cd/0000000000000001/1",
      duration_ms: 3000,
      sample_rate: 44100,
      bucket_frames: 44100,
      peaks: [0.4, null, 0.8],
    }),
  ).not.toContain("M333.33");
});
