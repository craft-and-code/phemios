import { describe, it, expect } from "vitest";
import { parseAudioPreferences } from "./audio-preferences";
describe("retained audio policies", () => {
  it("keeps a disabled default and exact user policies", () => {
    expect(parseAudioPreferences(null)).toEqual({
      crossfadeMs: 0,
      repeat: "off",
      policy: "without-effects",
      volume: 0.5,
    });
    expect(
      parseAudioPreferences('{"crossfadeMs":2500,"repeat":"all","policy":"dsp"}').crossfadeMs,
    ).toBe(2500);
  });
  it("rejects corrupt or unbounded settings without replacing storage", () => {
    for (const ms of [-1, 10001, 1.5, "2500", null])
      expect(() =>
        parseAudioPreferences(JSON.stringify({ crossfadeMs: ms, repeat: "off", policy: "dsp" })),
      ).toThrow();
    expect(() =>
      parseAudioPreferences('{"crossfadeMs":0,"repeat":"random","policy":"dsp"}'),
    ).toThrow();
  });
});

it("migrates old audio preferences and rejects invalid retained volumes", () => {
  const old = { crossfadeMs: 0, repeat: "off", policy: "without-effects" };
  expect(parseAudioPreferences(JSON.stringify(old)).volume).toBe(0.5);
  expect(parseAudioPreferences(JSON.stringify({ ...old, volume: 0 })).volume).toBe(0);
  for (const volume of [-0.1, 1.01, "0.5", null])
    expect(() => parseAudioPreferences(JSON.stringify({ ...old, volume }))).toThrow();
});
