import { describe, it, expect } from "vitest";
import { project, unproject, wrapLongitude, countryAt, type Country } from "./projection";
describe("globe coordinates", () => {
  it("round trips visible coordinates for rotated and tilted views", () => {
    for (const center of [
      [0, 0],
      [35, 20],
      [-160, -30],
    ] as const) {
      for (const offset of [
        [0, 0],
        [15, 5],
        [-40, -12],
      ] as const) {
        const source = [center[0] + offset[0], center[1] + offset[1]] as const;
        const p = project(source, center);
        const inverse = unproject([p.x, p.y], center);
        expect(inverse?.[0]).toBeCloseTo(wrapLongitude(source[0]));
        expect(inverse?.[1]).toBeCloseTo(source[1]);
      }
    }
  });
  it("rejects outside picks and marks the hidden hemisphere", () => {
    expect(unproject([1.1, 0], [0, 0])).toBeNull();
    expect(project([180, 0], [0, 0]).z).toBeLessThan(0);
  });
  it("picks islands across the antimeridian without filling their holes", () => {
    const country: Country = {
      code: "XX",
      name: "Fixture",
      polygons: [
        [
          [
            [170, -10],
            [-170, -10],
            [-170, 10],
            [170, 10],
            [170, -10],
          ],
          [
            [175, -3],
            [-175, -3],
            [-175, 3],
            [175, 3],
            [175, -3],
          ],
        ],
      ],
    };
    expect(countryAt([172, 0], [country])).toBe(country);
    expect(countryAt([-172, 0], [country])).toBe(country);
    expect(countryAt([179, 0], [country])).toBeUndefined();
    expect(countryAt([0, 0], [country])).toBeUndefined();
  });
});
