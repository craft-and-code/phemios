/** Degrees and normalized sphere coordinates, independent of canvas pixels. */
export type Point = readonly [number, number];
export interface Country {
  code: string;
  name: string;
  polygons: Point[][][];
}
const radians = Math.PI / 180;
export function wrapLongitude(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}
/** Orthographic projection; negative z is hidden behind the sphere. */
export function project(point: Point, center: Point): { x: number; y: number; z: number } {
  const latitude = point[1] * radians,
    longitude = (point[0] - center[0]) * radians,
    tilt = center[1] * radians;
  return {
    x: Math.cos(latitude) * Math.sin(longitude),
    y: -(
      Math.cos(tilt) * Math.sin(latitude) -
      Math.sin(tilt) * Math.cos(latitude) * Math.cos(longitude)
    ),
    z:
      Math.sin(tilt) * Math.sin(latitude) +
      Math.cos(tilt) * Math.cos(latitude) * Math.cos(longitude),
  };
}
/** Returns only the front hemisphere; outside the circle is not a country. */
export function unproject(point: Point, center: Point): Point | null {
  const [x, screenY] = point,
    y = -screenY,
    radius = Math.hypot(x, y);
  if (radius > 1) return null;
  if (radius < 1e-10) return center;
  const c = Math.asin(radius),
    tilt = center[1] * radians;
  return [
    wrapLongitude(
      center[0] +
        Math.atan2(
          x * Math.sin(c),
          radius * Math.cos(tilt) * Math.cos(c) - y * Math.sin(tilt) * Math.sin(c),
        ) /
          radians,
    ),
    Math.asin(Math.cos(c) * Math.sin(tilt) + (y * Math.sin(c) * Math.cos(tilt)) / radius) / radians,
  ];
}
function inRing(point: Point, ring: Point[]): boolean {
  let inside = false;
  const longitudes: number[] = [];
  for (const vertex of ring) {
    const previous = longitudes.at(-1) ?? vertex[0];
    longitudes.push(previous + wrapLongitude(vertex[0] - previous));
  }
  const first = longitudes[0];
  if (first === undefined) return false;
  const x = first + wrapLongitude(point[0] - first),
    y = point[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j],
      ax = longitudes[i],
      bx = longitudes[j];
    if (!a || !b || ax === undefined || bx === undefined) continue;
    if (a[1] > y !== b[1] > y && x < ((bx - ax) * (y - a[1])) / (b[1] - a[1]) + ax)
      inside = !inside;
  }
  return inside;
}
/** Polygon holes and antimeridian crossings are preserved during picking. */
export function countryAt(point: Point, countries: readonly Country[]): Country | undefined {
  return countries.find((country) =>
    country.polygons.some(
      ([outer, ...holes]) =>
        outer && inRing(point, outer) && !holes.some((hole) => inRing(point, hole)),
    ),
  );
}
