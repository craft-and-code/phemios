import { expect, it } from "vitest";
import { createTerminalBands } from "./terminal-bands";
it("preserves independent band energy and clamps invalid native values", () => {
  const meter = createTerminalBands();
  const rows = meter.observe(
    Array.from({ length: 24 }, (_, i) => i / 23),
    0,
    "one",
  );
  expect(rows).toHaveLength(24);
  expect(rows[0]?.level).toBe(0);
  expect(rows[23]?.level).toBe(1);
});
it("holds peaks for 350 consumed milliseconds, decays at .45 per second and freezes on pause", () => {
  const meter = createTerminalBands();
  meter.observe([1, 0], 0, "one");
  expect(meter.observe([0, 0], 200, "one")[0]?.peak).toBe(1);
  expect(meter.observe([0, 0], 1350, "one")[0]?.peak).toBeCloseTo(0.55);
  expect(meter.observe(undefined, 9000, "one")[0]?.peak).toBeCloseTo(0.55);
  expect(meter.observe([0, 0], 100, "one")[0]?.peak).toBe(0);
  meter.observe([1, 0], 200, "one");
  expect(meter.observe([0, 0], 300, "two")[0]?.peak).toBe(0);
});

it("retains one segment column for each of the 24 supplied frequency bands", () => {
  const rows = createTerminalBands().observe(
    Array.from({ length: 24 }, (_, i) => i / 24),
    0,
    "track",
  );
  expect(rows).toHaveLength(24);
  expect(rows[1]?.level).toBe(1 / 24);
  expect(rows[23]?.level).toBe(23 / 24);
});
