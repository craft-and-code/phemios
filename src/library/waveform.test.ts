import { expect, it } from "vitest";
import { parseWaveform, waveformPath } from "./waveform";
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
