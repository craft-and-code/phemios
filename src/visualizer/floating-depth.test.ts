import { expect, it } from "vitest";
import { depthProjection } from "./floating-depth";
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
