import type { Particle } from "./particles";
/** Rigid camera rotation preserves the audio deformation and keeps depth projection bounded. */
export function orbit(point: Particle, yaw: number, pitch: number): Particle {
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw),
    z = point.z * Math.cos(yaw) - point.x * Math.sin(yaw);
  return {
    ...point,
    x,
    y: point.y * Math.cos(pitch) - z * Math.sin(pitch),
    z: z * Math.cos(pitch) + point.y * Math.sin(pitch),
  };
}
export function orbitDrag(yaw: number, pitch: number, dx: number, dy: number): [number, number] {
  return [yaw + dx * 0.006, Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006))];
}

/** Rotate the canvas-local pool in place with one camera matrix, avoiding a second point array. */
export function orbitField(points: Particle[], yaw: number, pitch: number): Particle[] {
  const cosYaw = Math.cos(yaw),
    sinYaw = Math.sin(yaw),
    cosPitch = Math.cos(pitch),
    sinPitch = Math.sin(pitch);
  for (const point of points) {
    const x = point.x * cosYaw + point.z * sinYaw,
      z = point.z * cosYaw - point.x * sinYaw,
      y = point.y;
    point.x = x;
    point.y = y * cosPitch - z * sinPitch;
    point.z = z * cosPitch + y * sinPitch;
  }
  return points;
}
