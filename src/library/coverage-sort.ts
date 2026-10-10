export type CoverageColumn = "title" | "current" | "missing" | "stale" | "failed" | "spectra";
export interface CoverageSort {
  column: CoverageColumn;
  direction: "asc" | "desc";
}
/** Missing counts descend on opening; clicking the selected column reverses its order. */
export const initialCoverageSort: CoverageSort = { column: "missing", direction: "desc" };
export function nextCoverageSort(current: CoverageSort, column: CoverageColumn): CoverageSort {
  return {
    column,
    direction:
      current.column === column
        ? current.direction === "asc"
          ? "desc"
          : "asc"
        : column === "title"
          ? "asc"
          : "desc",
  };
}
