import { expect, it } from "vitest";
import { readMenuPreferences, saveMenuPreferences, moveMenu } from "./menu-preferences";
import { sections } from "./routes";
const ids = sections.map((item) => item.id);
it("shows all sections initially and appends newly available menus without losing a saved order", () => {
  expect(readMenuPreferences({ getItem: () => null })).toEqual({ order: ids, hidden: [] });
  const saved = { version: 1, order: ["podcasts", "albums"], hidden: ["albums"] };
  const value = readMenuPreferences({ getItem: () => JSON.stringify(saved) });
  expect(value.order.slice(0, 2)).toEqual(["podcasts", "albums"]);
  expect(value.order).toHaveLength(ids.length);
  expect(value.hidden).toEqual(["albums"]);
});
it("moves one section to its chosen position without duplicating or dropping any section", () => {
  const moved = moveMenu(ids, "labels", "artists");
  expect(moved[0]).toBe("labels");
  expect([...moved].sort()).toEqual([...ids].sort());
  expect(moveMenu(moved, "labels", "labels")).toEqual(moved);
});
it("preserves malformed saved menus and surfaces write failures", () => {
  const invalid = { version: 1, order: ["albums", "albums"], hidden: [] };
  const storage = {
    getItem: () => JSON.stringify(invalid),
    setItem: () => {
      throw new Error("No write");
    },
  };
  expect(() => readMenuPreferences(storage)).toThrow();
  expect(() => saveMenuPreferences(storage, { order: ids, hidden: [] })).toThrow();
  expect(() =>
    saveMenuPreferences(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("No space");
        },
      },
      { order: ids, hidden: [] },
    ),
  ).toThrow("No space");
});
it("places a new mood menu in its default group when the previous menu order was untouched", () => {
  const previous = ids.filter((id) => id !== "moods");
  expect(
    readMenuPreferences({
      getItem: () => JSON.stringify({ version: 1, order: previous, hidden: [] }),
    }).order,
  ).toEqual(ids);
});
