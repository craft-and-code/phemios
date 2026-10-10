import { geoArea, geoOrthographic } from "d3-geo";
import type { Country, Point } from "./projection";

type Geometry = { type: "MultiPolygon"; coordinates: number[][][][] };
const geometries = new WeakMap<Country, Geometry>();

/** Normalize the bundled small-country rings to D3's spherical winding, preserving holes and source bytes. */
export function countryGeometry(country: Country): Geometry {
  const cached = geometries.get(country);
  if (cached) return cached;
  const coordinates = country.polygons.map((polygon) =>
    polygon.map((ring, index) => {
      const points = ring.map(([longitude, latitude]) => [longitude, latitude]);
      const small = geoArea({ type: "Polygon", coordinates: [points] }) <= 2 * Math.PI;
      return small === (index === 0) ? points : points.reverse();
    }),
  );
  const geometry: Geometry = { type: "MultiPolygon", coordinates };
  geometries.set(country, geometry);
  return geometry;
}

/** Match the manual inverse/picking convention while clipping complete polygons at the visible horizon. */
export function globeProjection(center: Point, radius: number, offset: Point) {
  return geoOrthographic()
    .rotate([-center[0], -center[1]])
    .scale(radius)
    .translate([offset[0], offset[1]])
    .clipAngle(90)
    .precision(0.25);
}
