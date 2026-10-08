import { it, expect } from "vitest";
import { relationSpace } from "./relation-space";
it("rotates real depth without losing or reordering collaboration identities", () => {
  const a = relationSpace(16, 0, 0, 1),
    b = relationSpace(16, Math.PI, 0, 1);
  expect(new Set(a.map((n) => n.index)).size).toBe(16);
  for (const node of a) {
    const opposite = b.find((n) => n.index === node.index)!;
    expect(opposite.depth).toBeCloseTo(-node.depth);
    expect(Math.sign(opposite.x - 450)).toBe(-Math.sign(node.x - 450));
  }
  expect(a.map((n) => n.depth)).toEqual(a.map((n) => n.depth).sort((a, b) => a - b));
  expect(() => relationSpace(17, 0, 0, 1)).toThrow();
  expect(() => relationSpace(1, 0, 0, 5)).toThrow();
  expect(relationSpace(0, 0, 0, 1)).toEqual([]);
});
it("keeps every dense-graph label readable and darkens spatially remote nodes", async () => {
  const { relationLabels, relationBrightness } = await import("./relation-space");
  const points = relationSpace(16, -0.35, 0.2, 1);
  const labels = relationLabels(points);
  expect(new Set(labels.map((p) => p.index)).size).toBe(16);
  for (const anchor of ["start", "end"]) {
    const positions = labels
      .filter((p) => p.anchor === anchor)
      .map((p) => p.y)
      .sort((a, b) => a - b);
    for (let i = 1; i < positions.length; i++)
      expect(positions[i]! - positions[i - 1]!).toBeGreaterThanOrEqual(26);
  }
  expect(relationBrightness(450, 255)).toBeGreaterThan(relationBrightness(800, 400));
  expect(relationLabels([])).toEqual([]);
});
it("gives rear spheres an explicitly darker palette even at the projected centre", async () => {
  const { relationTone } = await import("./relation-space");
  expect(relationTone(-1, 450, 255).highlight).not.toBe(relationTone(1, 450, 255).highlight);
  expect(relationTone(-1, 450, 255).brightness).toBeLessThan(relationTone(1, 450, 255).brightness);
});
