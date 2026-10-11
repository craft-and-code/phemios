import { expect, it } from "vitest";
import { depthProjection, drawFloatingDepth } from "./floating-depth";
it("projects nearer stage geometry larger and clearer than the far plane", () => {
  const near = depthProjection({ x: 1, y: 1, z: -2, energy: 0 }, 1000, 600),
    far = depthProjection({ x: 1, y: 1, z: 2, energy: 0 }, 1000, 600);
  expect(near.perspective).toBeGreaterThan(far.perspective);
  expect(near.alpha).toBeGreaterThan(far.alpha);
  expect(near.x - 500).toBeGreaterThan(far.x - 500);
});
it("keeps the projection bounded when camera rotation brings a guide near the lens", () => {
  const point = depthProjection({ x: 2, y: 1, z: -6, energy: 0 }, 1000, 600);
  expect(Object.values(point).every(Number.isFinite)).toBe(true);
  expect(point.alpha).toBeLessThanOrEqual(0.16);
});

it("draws only the bounded perspective floor, without orbit rings or dashed paths", () => {
  let strokes = 0,
    dashed = false;
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      strokes++;
    },
    setLineDash(values: number[]) {
      dashed ||= values.length > 0;
    },
  };
  drawFloatingDepth(context as unknown as CanvasRenderingContext2D, 1000, 600, 0, 0, 0, "#d8f36a");
  expect(strokes).toBe(14);
  expect(dashed).toBe(false);
});
