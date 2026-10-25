import { expect, it } from "vitest";
import { objectListStep, objectListAfterRemoval, reorderObjects } from "./object-list";
it("navigates and clamps single selection with arrows and Home/End", () => {
  const rows = ["a", "b", "c"];
  expect(objectListStep(rows, undefined, "ArrowDown")).toBe("a");
  expect(objectListStep(rows, undefined, "ArrowUp")).toBe("c");
  expect(objectListStep(rows, "b", "ArrowUp")).toBe("a");
  expect(objectListStep(rows, "a", "ArrowUp")).toBe("a");
  expect(objectListStep(rows, "c", "ArrowDown")).toBe("c");
  expect(objectListStep(rows, "b", "Home")).toBe("a");
  expect(objectListStep(rows, "b", "End")).toBe("c");
  expect(objectListStep([], undefined, "ArrowDown")).toBeUndefined();
});
it("advances chained removals to the predecessor, then successor, then empty", () => {
  expect(objectListAfterRemoval(["a", "b", "c"], "b")).toBe("a");
  expect(objectListAfterRemoval(["a", "b", "c"], "a")).toBe("b");
  expect(objectListAfterRemoval(["a"], "a")).toBeUndefined();
  expect(objectListAfterRemoval(["a"], "missing")).toBeUndefined();
});
it("reorders without duplication or mutation, including a tail drop", () => {
  const original = ["a", "b", "c"];
  expect(reorderObjects(original, "c", "a")).toEqual(["c", "a", "b"]);
  expect(reorderObjects(original, "a")).toEqual(["b", "c", "a"]);
  expect(reorderObjects(original, "a", "missing")).toEqual(original);
  expect(original).toEqual(["a", "b", "c"]);
});
