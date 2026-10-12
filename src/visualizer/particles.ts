/** Deterministic 3D geometry, deformed only by audible native band levels. */
export type Scene = "sphere" | "waves" | "landscape" | "floating" | "off";
export interface Particle {
  x: number;
  y: number;
  z: number;
  energy: number;
}
/** Canvas-local mutable points are overwritten on every update; depth sorting preserves the next frame's geometry.
 * Retain an independent snapshot when a caller needs an earlier frame. Fixed trigonometric bases live only with this field.
 */
export function createParticleField(count = 1200) {
  const points = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, energy: 0 }));
  const sphere = new Float64Array(points.length * 4),
    grid = new Float64Array(points.length * 2),
    bands = new Float64Array(4),
    columns = Math.ceil(Math.sqrt(count));
  for (let index = 0; index < points.length; index++) {
    const y = 1 - (2 * (index + 0.5)) / count,
      ring = Math.sqrt(Math.max(0, 1 - y * y)),
      phase = index * 2.399963229728653;
    sphere[index * 4] = Math.cos(phase) * ring;
    sphere[index * 4 + 1] = y;
    sphere[index * 4 + 2] = Math.sin(phase) * ring;
    sphere[index * 4 + 3] = phase * 0.3;
    grid[index * 2] = ((index % columns) / (columns - 1) - 0.5) * 2.8;
    grid[index * 2 + 1] = (Math.floor(index / columns) / (columns - 1) - 0.5) * 2.8;
  }
  return {
    update(scene: Scene, time: number, levels: readonly number[]): Particle[] {
      for (let i = 0; i < 4; i++) bands[i] = Math.max(0, Math.min(1, levels[i] ?? 0));
      const angle = time * 0.16,
        cos = Math.cos(angle),
        sin = Math.sin(angle),
        tilt = scene === "sphere" ? -0.1 : -0.55,
        cosTilt = Math.cos(tilt),
        sinTilt = Math.sin(tilt);
      for (let index = 0; index < points.length; index++) {
        const band = bands[index % 4]!;
        let x: number, y: number, z: number;
        if (scene === "sphere") {
          const pulse = 1 + band * (0.12 + 0.2 * Math.sin(sphere[index * 4 + 3]! + time * 3));
          x = sphere[index * 4]! * pulse;
          y = sphere[index * 4 + 1]! * pulse;
          z = sphere[index * 4 + 2]! * pulse;
        } else {
          x = grid[index * 2]!;
          z = grid[index * 2 + 1]!;
          const wave = Math.sin(x * 3 + time * 3) * Math.cos(z * 2 - time * 2);
          y =
            scene === "waves"
              ? wave * (0.05 + band * 0.65)
              : Math.abs(wave) * (0.12 + band * 0.85) - 0.4;
        }
        const rx = x * cos + z * sin,
          rz = z * cos - x * sin,
          point = points[index]!;
        point.x = rx;
        point.y = y * cosTilt - rz * sinTilt;
        point.z = rz * cosTilt + y * sinTilt;
        point.energy = band;
      }
      return points;
    },
  };
}
/** Independent snapshots are available for callers that do not retain a canvas-local field. */
export function particles(scene: Scene, time: number, levels: readonly number[], count = 1200) {
  return createParticleField(count).update(scene, time, levels);
}
