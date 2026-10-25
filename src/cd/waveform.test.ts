import { expect, it } from "vitest";
import { parsePlayback, idlePlayback } from "../library/playback-state";
import { parseCdWaveform } from "./waveform";
import { parseWaveform, waveformPath } from "../library/waveform";
const reference = "track:cd/0000000000000001/7";
const wave = {
  reference,
  duration_ms: 1000,
  sample_rate: 44100,
  bucket_frames: 14700,
  peaks: [0.5, null, 0.2],
};
it("accepts only an attributed bounded progressive CD envelope", () => {
  expect(parseCdWaveform(wave, reference, 1000)).toBe(wave);
  expect(waveformPath(wave)).toContain("M0.00 11.00V29.00");
  expect(waveformPath(wave)).not.toContain("M333.33");
  for (const change of [
    { reference: "track:other" },
    { duration_ms: 0 },
    { sample_rate: 48000 },
    { bucket_frames: 1 },
    { peaks: [0.2] },
    { peaks: Array(1025).fill(0) },
    { peaks: [NaN, null, 0.2] },
    { peaks: [1.1, null, 0.2] },
    { peaks: ["0.2", null, 0.2] },
  ])
    expect(() => parseCdWaveform({ ...wave, ...change }, reference, 1000)).toThrow();
  expect(() => parseCdWaveform(wave, reference, 2000)).toThrow();
  expect(() => parseWaveform(wave, reference)).toThrow();
});
it("keeps gaps and pause data in CD snapshots while rejecting cross-source envelopes", () => {
  const state = {
    ...idlePlayback,
    status: "paused",
    source: "cd",
    reference,
    duration_ms: 1000,
    cd_waveform: wave,
  };
  expect(parsePlayback(state).cd_waveform).toEqual(wave);
  expect(() => parsePlayback({ ...state, source: "aede" })).toThrow();
  expect(() => parsePlayback({ ...state, reference: "track:cd/0000000000000002/7" })).toThrow();
  expect(parsePlayback({ ...state, cd_waveform: null }).cd_waveform).toBeNull();
});
