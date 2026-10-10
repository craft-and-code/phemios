import { expect, it } from "vitest";
import { nextCoverageSort, initialCoverageSort } from "./coverage-sort";
it("starts with missing analyses first, toggles the chosen column and resets a new numeric column to descending", () => {
  expect(initialCoverageSort).toEqual({ column: "missing", direction: "desc" });
  expect(nextCoverageSort(initialCoverageSort, "missing")).toEqual({
    column: "missing",
    direction: "asc",
  });
  expect(nextCoverageSort(initialCoverageSort, "title")).toEqual({
    column: "title",
    direction: "asc",
  });
  expect(nextCoverageSort({ column: "title", direction: "asc" }, "failed")).toEqual({
    column: "failed",
    direction: "desc",
  });
});
