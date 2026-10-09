import { expect, it } from "vitest";
import { equalizerHeights } from "./equalizer";
it("responds to measured transients with independent attack and release", () => {
  const next = equalizerHeights([0, 0, 0, 0], 1);
  expect(next[0]).toBeLessThan(next[2]!);
  expect(next[2]).toBeLessThan(next[1]!);
  expect(next[1]).toBeLessThan(next[3]!);
  const release = equalizerHeights(next, 0);
  expect(release.every((value, i) => value < next[i]!)).toBe(true);
});

it("keeps distinct measured envelopes on sustained audio and decays every bar to silence", () => {
  let heights = [0, 0, 0, 0];
  for (let i = 0; i < 100; i++) heights = equalizerHeights(heights, 0.8);
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.2);
  for (let i = 0; i < 500; i++) heights = equalizerHeights(heights, 0);
  expect(Math.max(...heights)).toBeLessThan(0.000001);
});
