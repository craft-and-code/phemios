import { expect, it } from "vitest";
import { orbit, orbitDrag, orbitField } from "./orbit";
it("rotates the camera without changing audio energy or point radius", () => {
  const p = { x: 1, y: 2, z: 3, energy: 0.7 },
    r = orbit(p, 0.9, -0.4);
  expect(Math.hypot(r.x, r.y, r.z)).toBeCloseTo(Math.hypot(p.x, p.y, p.z));
  expect(r.energy).toBe(0.7);
  expect(r.x).not.toBe(p.x);
  expect(orbitDrag(0, 0, 100, 900)).toEqual([0.6, 1.2]);
});

it("rotates resident points with the exact snapshot camera matrix", () => {
  const points = [
    { x: 1, y: 2, z: 3, energy: 0.7 },
    { x: -1.2, y: 0.02, z: 0.73, energy: 0.1 },
  ];
  const resident = [...points];
  for (const [yaw, pitch] of [
    [0, 0],
    [0.9, -0.4],
    [-1.7, 1.2],
  ]) {
    const expected = points.map((point) => orbit(point, yaw!, pitch!));
    expect(orbitField(points, yaw!, pitch!)).toBe(points);
    expect(points).toEqual(expected);
    expect(points[0]).toBe(resident[0]);
    expect(points[1]).toBe(resident[1]);
  }
});
