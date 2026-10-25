import { expect, it } from "vitest";
import { listInsertion, movesListItem } from "./list-insertion";
import { insertionFixture } from "./list-insertion-test-support";
it("uses one visual boundary for both sides of the same gap", () => {
  for (const attribute of ["data-object-item", "data-menu-item"] as const) {
    const { list, rows, items } = insertionFixture(["a", "b", "c"], attribute);
    const belowFirst = listInsertion(list, attribute, items, rows[0]!, 119);
    const aboveSecond = listInsertion(list, attribute, items, rows[1]!, 131);
    expect(belowFirst).toEqual(aboveSecond);
    expect(belowFirst).toEqual({ row: "b", edge: "before", before: "b" });
  }
});
it("resolves the same before/after row boundary and canonical destination for pointer and native drops", () => {
  const { list, rows, child, items } = insertionFixture();
  expect(listInsertion(list, "data-object-item", items, child, 139)).toEqual({
    row: "b",
    edge: "before",
    before: "b",
  });
  expect(listInsertion(list, "data-object-item", items, rows[1]!, 140)).toEqual({
    row: "c",
    edge: "before",
    before: "c",
  });
  expect(listInsertion(list, "data-object-item", items, rows[2]!, 179)).toEqual({
    row: "c",
    edge: "after",
    before: undefined,
  });
});
it("marks list gaps, the empty tail and an empty destination without inventing an outside target", () => {
  const { list, items } = insertionFixture();
  expect(listInsertion(list, "data-object-item", items, list, 125)?.before).toBe("b");
  expect(listInsertion(list, "data-object-item", items, list, 280)).toEqual({
    row: "c",
    edge: "after",
    before: undefined,
  });
  expect(listInsertion(list, "data-object-item", items, list, 99)).toBeUndefined();
  expect(listInsertion(list, "data-object-item", items, list, 301)).toBeUndefined();
  expect(listInsertion(list, "data-object-item", items, null, 140)).toBeUndefined();
  expect(listInsertion(list, "data-object-item", items, {} as Element, 140)).toBeUndefined();
  const empty = insertionFixture([]);
  expect(listInsertion(empty.list, "data-object-item", [], empty.list, 140)).toEqual({
    row: undefined,
    edge: "before",
    before: undefined,
  });
});
it("uses the same insertion contract for collection-to-menu copies and refuses obsolete rows", () => {
  const { list, rows, items } = insertionFixture(
    ["albums", "tracks", "collections"],
    "data-menu-item",
  );
  expect(listInsertion(list, "data-menu-item", items, rows[1]!, 149)).toEqual({
    row: "collections",
    edge: "before",
    before: "collections",
  });
  expect(
    listInsertion(list, "data-menu-item", ["albums", "collections"], rows[1]!, 149),
  ).toBeUndefined();
  expect(listInsertion(list, "data-menu-item", items, rows[1]!, Number.NaN)).toBeUndefined();
});
it("does not advertise a move onto its current position or an unknown destination", () => {
  const items = ["a", "b", "c"];
  expect(movesListItem(items, "b", "b")).toBe(false);
  expect(movesListItem(items, "b", "c")).toBe(false);
  expect(movesListItem(items, "c", undefined)).toBe(false);
  expect(movesListItem(items, "a", "foreign")).toBe(false);
  expect(movesListItem(items, "foreign", "a")).toBe(false);
  expect(movesListItem(items, "c", "a")).toBe(true);
  expect(movesListItem(items, "a", undefined)).toBe(true);
});
