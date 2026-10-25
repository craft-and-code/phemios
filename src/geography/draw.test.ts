import { afterEach, expect, it, vi } from "vitest";
import { drawGlobe } from "./draw";
import { recordingCanvas } from "./draw-test-fixtures";
import type { Country } from "./projection";

afterEach(() => vi.unstubAllGlobals());

it("closes a country across the horizon along the limb instead of a straight chord", () => {
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  const country: Country = {
    code: "XX",
    name: "Horizon",
    polygons: [
      [
        [
          [60, -30],
          [140, -30],
          [140, 30],
          [60, 30],
          [60, -30],
        ],
      ],
    ],
  };
  const { canvas, fills } = recordingCanvas();
  drawGlobe(canvas, [country], [0, 0], 1, new Set(), new Set());
  expect(fills[0]?.some(([x, y]) => x > 91.8 && Math.abs(y - 50) < 3)).toBe(true);
  expect(fills.flat().every(([x, y]) => Math.hypot(x - 50, y - 50) < 42.01)).toBe(true);
});

it("retains the drawing buffer during rotation instead of reallocating every frame", () => {
  vi.stubGlobal("window", { devicePixelRatio: 1.5 });
  const { canvas } = recordingCanvas();
  let writes = 0;
  for (const key of ["width", "height"] as const) {
    let size = 0;
    Object.defineProperty(canvas, key, {
      get: () => size,
      set: (value) => {
        writes++;
        size = value;
      },
    });
  }
  drawGlobe(canvas, [], [0, 0], 1, new Set(), new Set());
  drawGlobe(canvas, [], [10, 0], 1, new Set(), new Set());
  expect(writes).toBe(2);
});
