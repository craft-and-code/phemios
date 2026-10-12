import { referenceParticles } from "./particles-test-fixtures";
import { expect, it } from "vitest";
import { particles, createParticleField, type Scene } from "./particles";
it("keeps bounded deterministic 3D geometry and changes its shape with the audio bands", () => {
  for (const scene of ["sphere", "waves", "landscape"] as Scene[]) {
    const quiet = particles(scene, 0, [0, 0, 0, 0], 100),
      loud = particles(scene, 0, [1, 0.2, 0.7, 0.4], 100);
    expect(quiet).toHaveLength(100);
    expect(quiet).toEqual(particles(scene, 0, [0, 0, 0, 0], 100));
    expect(loud).not.toEqual(quiet);
    expect(
      loud.every((point) => [point.x, point.y, point.z, point.energy].every(Number.isFinite)),
    ).toBe(true);
  }
});

it("reuses a bounded frame pool across changing geometry and camera depth ordering", () => {
  const field = createParticleField(1200);
  const first = field.update("sphere", 0, [0, 0, 0, 0]);
  const resident = new Set(first);
  first.sort((a, b) => b.z - a.z);
  for (const scene of ["sphere", "waves", "landscape"] as const) {
    for (const time of [0, 0.125, 19.75]) {
      for (const levels of [
        [0, 0, 0, 0],
        [1, 0.2, 0.7, 0.4],
      ]) {
        const frame = field.update(scene, time, levels);
        expect(frame).toBe(first);
        expect(frame.every((point) => resident.has(point))).toBe(true);
        expect(frame).toEqual(referenceParticles(scene, time, levels));
        frame.sort((a, b) => b.z - a.z);
      }
    }
  }
});
