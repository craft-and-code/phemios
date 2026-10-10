import { expect, it } from "vitest";
import { orbit, orbitDrag } from "./orbit";
it("rotates the camera without changing audio energy or point radius", () => {
  const p = { x: 1, y: 2, z: 3, energy: 0.7 },
    r = orbit(p, 0.9, -0.4);
  expect(Math.hypot(r.x, r.y, r.z)).toBeCloseTo(Math.hypot(p.x, p.y, p.z));
  expect(r.energy).toBe(0.7);
  expect(r.x).not.toBe(p.x);
  expect(orbitDrag(0, 0, 100, 900)).toEqual([0.6, 1.2]);
});
