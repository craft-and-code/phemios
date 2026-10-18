import { expect, it } from "vitest";
import { createBassPulse } from "./bass-pulse";
const sample = (position: number, level: number, reference = "track:a") => ({
  position,
  reference,
  levels: [level, level, 0.9],
  frequencies: [50, 120, 2000],
});
it("reacts to low-frequency attacks, with a bounded cooldown rather than sustained bass or treble", () => {
  const detector = createBassPulse();
  expect(detector.observe(sample(0, 0))).toBe(0);
  expect(detector.observe(sample(100, 0.7))).toBeGreaterThan(0);
  expect(detector.observe(sample(200, 0.7))).toBe(0);
  expect(detector.observe(sample(250, 0))).toBe(0);
  expect(detector.observe(sample(300, 0.8))).toBe(0);
  expect(detector.observe(sample(400, 0))).toBe(0);
  expect(detector.observe(sample(500, 0.8))).toBeGreaterThan(0);
  expect(detector.observe(sample(600, 0.8))).toBe(0);
});
it("resets on track/seek changes and never invents a pulse from invalid or absent bass samples", () => {
  const detector = createBassPulse();
  detector.observe(sample(1000, 0));
  expect(detector.observe(sample(1100, 0.8))).toBeGreaterThan(0);
  expect(detector.observe(sample(100, 0.8))).toBe(0);
  expect(detector.observe(sample(200, 0.8, "track:b"))).toBe(0);
  expect(detector.observe({ ...sample(300, 1), frequencies: [2000, 4000, 8000] })).toBe(0);
  expect(detector.observe({ ...sample(400, NaN), frequencies: [50, 120, 2000] })).toBe(0);
  expect(detector.observe({ ...sample(NaN, 1) })).toBe(0);
  detector.reset();
  expect(detector.observe(sample(500, 1))).toBe(0);
});

it("detects quieter attacks without treating near-silent noise as a beat", () => {
  const detector = createBassPulse();
  detector.observe(sample(0, 0));
  expect(detector.observe(sample(100, 0.002))).toBe(0);
  expect(detector.observe(sample(200, 0.08))).toBeGreaterThan(0);
});
