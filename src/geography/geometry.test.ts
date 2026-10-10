import { expect, it } from "vitest";
import { geoContains, geoPath } from "d3-geo";
import { countryGeometry, globeProjection } from "./geometry";
import { project, type Country } from "./projection";
import borders from "../../public/geography/countries.json";

it("matches click projection through rotation and keeps the chosen hemisphere", () => {
  for (const center of [
    [8, 22],
    [-160, 70],
    [90, -30],
  ] as const) {
    const point = [center[0] + 20, center[1] - 5] as const;
    const projected = globeProjection(center, 100, [120, 120])(point as [number, number]);
    const manual = project(point, center);
    expect(projected?.[0]).toBeCloseTo(120 + manual.x * 100);
    expect(projected?.[1]).toBeCloseTo(120 + manual.y * 100);
  }
});

it("normalizes antimeridian countries without painting their spherical complement", () => {
  const russia = (borders as unknown as Country[]).find((country) => country.code === "RU")!;
  const source = JSON.stringify(russia);
  const geometry = countryGeometry(russia);
  expect(geoContains(geometry, [100, 60])).toBe(true);
  expect(geoContains(geometry, [0, 0])).toBe(false);
  for (const center of [
    [8, 22],
    [-160, 70],
    [120, 0],
  ] as const) {
    const area = geoPath(globeProjection(center, 100, [0, 0])).area(geometry);
    expect(area).toBeLessThan(Math.PI * 10000 * 0.4);
  }
  expect(JSON.stringify(russia)).toBe(source);
});

it("retains spherical polygon holes when normalizing opposite input winding", () => {
  const country: Country = {
    code: "XX",
    name: "With a hole",
    polygons: [
      [
        [
          [-20, -20],
          [20, -20],
          [20, 20],
          [-20, 20],
          [-20, -20],
        ],
        [
          [-5, -5],
          [-5, 5],
          [5, 5],
          [5, -5],
          [-5, -5],
        ],
      ],
    ],
  };
  expect(geoContains(countryGeometry(country), [10, 0])).toBe(true);
  expect(geoContains(countryGeometry(country), [0, 0])).toBe(false);
});
