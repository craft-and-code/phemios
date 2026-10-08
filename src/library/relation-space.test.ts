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
