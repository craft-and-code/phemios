import { expect, it } from "vitest";
import { createTerminalBands } from "./terminal-bands";
it("merges all 24 native bands into the terminal's twelve bars using neighbouring maxima", () => {
  const meter = createTerminalBands();
  const rows = meter.observe(
    Array.from({ length: 24 }, (_, i) => i / 23),
    0,
    "one",
  );
  expect(rows).toHaveLength(12);
  expect(rows[0]?.level).toBe(1 / 23);
  expect(rows[11]?.level).toBe(1);
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
