// Test-only reference for the preallocation renderer equivalence check.
/** Deterministic 3D geometry, deformed only by audible native band levels. */
export type Scene = "sphere" | "waves" | "landscape" | "floating" | "off";
export interface Particle {
  x: number;
  y: number;
  z: number;
  energy: number;
}
export function referenceParticles(
  scene: Scene,
  time: number,
  levels: readonly number[],
  count = 1200,
): Particle[] {
  const bands = Array.from({ length: 4 }, (_, index) =>
    Math.max(0, Math.min(1, levels[index] ?? 0)),
  );
  return Array.from({ length: count }, (_, index) => {
    const band = bands[index % 4]!,
      phase = index * 2.399963229728653;
    let x: number, y: number, z: number;
    if (scene === "sphere") {
      y = 1 - (2 * (index + 0.5)) / count;
      const ring = Math.sqrt(Math.max(0, 1 - y * y)),
        pulse = 1 + band * (0.12 + 0.2 * Math.sin(phase * 0.3 + time * 3));
      x = Math.cos(phase) * ring * pulse;
      z = Math.sin(phase) * ring * pulse;
      y *= pulse;
    } else {
      const columns = Math.ceil(Math.sqrt(count)),
        row = Math.floor(index / columns),
        col = index % columns;
      x = (col / (columns - 1) - 0.5) * 2.8;
      z = (row / (columns - 1) - 0.5) * 2.8;
      const wave = Math.sin(x * 3 + time * 3) * Math.cos(z * 2 - time * 2);
      y =
        scene === "waves"
          ? wave * (0.05 + band * 0.65)
          : Math.abs(wave) * (0.12 + band * 0.85) - 0.4;
    }
    const angle = time * 0.16,
      rx = x * Math.cos(angle) + z * Math.sin(angle),
      rz = z * Math.cos(angle) - x * Math.sin(angle),
      tilt = scene === "sphere" ? -0.1 : -0.55;
    return {
      x: rx,
      y: y * Math.cos(tilt) - rz * Math.sin(tilt),
      z: rz * Math.cos(tilt) + y * Math.sin(tilt),
      energy: band,
    };
  });
}
