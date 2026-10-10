import { expect, it } from "vitest";
import { particles, type Scene } from "./particles";
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
