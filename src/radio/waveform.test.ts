import { expect, it } from "vitest";
import { radioWaveform } from "./waveform";
it("keeps silence moving but maps real PCM independently of its idle phase", () => {
  const silent = new Float32Array(32),
    samples = new Float32Array([0.5, -0.5, 0.2, -0.2]);
  expect(radioWaveform(silent, 0).measured).toBe(false);
  expect(radioWaveform(silent, 0).path).not.toBe(radioWaveform(silent, 1).path);
  expect(radioWaveform(samples, 0).measured).toBe(true);
  expect(radioWaveform(samples, 0).path).toBe(radioWaveform(samples, 1).path);
  expect(radioWaveform(new Float32Array([NaN, Infinity, -Infinity]), 0).path).not.toMatch(
    /NaN|Infinity/,
  );
  const coordinates = radioWaveform(new Float32Array([20, -20]), 0)
    .path.trim()
    .split(/[ML ]+/)
    .filter(Boolean)
    .map(Number);
  expect(
    coordinates.every((value, index) =>
      index % 2 ? value >= 20 && value <= 110 : value >= 0 && value <= 900,
    ),
  ).toBe(true);
});

it("falls back after a transient sampler error and resumes real measurements on the next frame", async () => {
  const { sampleRadioWave } = await import("./waveform");
  const samples = new Float32Array(8);
  expect(
    sampleRadioWave(samples, (buffer) => {
      buffer.fill(1);
      throw Error("Interrupted analyser");
    }),
  ).toBe(false);
  expect([...samples]).toEqual(Array(8).fill(0));
  expect(
    sampleRadioWave(samples, (buffer) => {
      buffer.fill(0.25);
      return true;
    }),
  ).toBe(true);
  expect([...samples]).toEqual(Array(8).fill(0.25));
});
