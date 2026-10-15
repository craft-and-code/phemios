import { expect, it } from "vitest";
import {
  readMenuPreferences,
  saveMenuPreferences,
  moveMenu,
  defaultMenuOrder,
  menuItem,
  visibleMenu,
} from "./menu-preferences";
import { sections } from "./routes";
const ids = sections.map((item) => item.id);
it("shows all sections initially and appends newly available menus without losing a saved order", () => {
  expect(readMenuPreferences({ getItem: () => null })).toEqual({
    order: defaultMenuOrder(),
    hidden: [],
  });
  const saved = { version: 1, order: ["podcasts", "albums"], hidden: ["albums"] };
  const value = readMenuPreferences({ getItem: () => JSON.stringify(saved) });
  expect(value.order.filter((id) => menuItem(id).kind === "section").slice(0, 2)).toEqual([
    "podcasts",
    "albums",
  ]);
  expect(value.order.filter((id) => menuItem(id).kind === "section")).toHaveLength(ids.length);
  expect(value.hidden).toEqual(["albums"]);
});
it("moves one section to its chosen position without duplicating or dropping any section", () => {
  const moved = moveMenu(ids, "labels", "artists");
  expect(moved.indexOf("labels")).toBe(moved.indexOf("artists") - 1);
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
  ).toEqual(defaultMenuOrder());
});

it("retains movable headings/spacers across reload and omits groups with every menu hidden", () => {
  let raw: string | null = null;
  const store = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const initial = readMenuPreferences(store);
  const order = moveMenu([...initial.order, "separator:control"], "heading:personal", "artists");
  saveMenuPreferences(store, { order, hidden: [] });
  expect(readMenuPreferences(store).order).toEqual(order);
  expect(visibleMenu({ ...initial, hidden: ids })).toEqual([]);
  expect(() =>
    saveMenuPreferences(store, { order: [...order, "separator:bad/path"], hidden: [] }),
  ).toThrow();
});

it("moves the legacy default tools order but preserves explicitly customised tools", () => {
  const legacy = defaultMenuOrder().filter(
    (r) => !["achievements", "encyclopedia", "relations"].includes(r),
  );
  legacy.splice(legacy.indexOf("analysis") + 1, 0, "relations");
  const migrated = readMenuPreferences({
    getItem: () => JSON.stringify({ version: 2, order: legacy, hidden: [] }),
  }).order;
  expect(migrated.indexOf("relations")).toBeLessThan(migrated.indexOf("doctor"));
  expect(migrated.indexOf("encyclopedia")).toBeGreaterThan(migrated.indexOf("podcasts"));
  const custom = moveMenu(defaultMenuOrder(), "relations", "analysis");
  expect(
    readMenuPreferences({
      getItem: () => JSON.stringify({ version: 2, order: custom, hidden: [] }),
    }).order,
  ).toEqual(custom);
});

it("groups Encyclopedia and discoveries directly after Relations", () => {
  const order = defaultMenuOrder();
  expect(order.indexOf("achievements")).toBeGreaterThan(order.indexOf("heading:tools"));
  expect(order.slice(order.indexOf("relations"), order.indexOf("relations") + 3)).toEqual([
    "relations",
    "encyclopedia",
    "achievements",
  ]);
  const legacy = order.filter((id) => !["encyclopedia", "achievements"].includes(id));
  legacy.splice(legacy.indexOf("history"), 0, "achievements");
  legacy.splice(legacy.indexOf("podcasts") + 1, 0, "encyclopedia");
  const restored = readMenuPreferences({
    getItem: () => JSON.stringify({ version: 2, order: legacy, hidden: ["achievements"] }),
  });
  expect(restored.order).toEqual(order);
  expect(restored.hidden).toEqual(["achievements"]);
  const custom = moveMenu(order, "encyclopedia", "artists");
  expect(
    readMenuPreferences({
      getItem: () => JSON.stringify({ version: 2, order: custom, hidden: [] }),
    }).order,
  ).toEqual(custom);
});

it("migrates the preceding default tools order while retaining customised positions and visibility", () => {
  const order = defaultMenuOrder();
  const previous = order.filter((id) => !["encyclopedia", "achievements"].includes(id));
  previous.splice(previous.indexOf("players"), 0, "achievements", "encyclopedia");
  expect(
    readMenuPreferences({
      getItem: () => JSON.stringify({ version: 3, order: previous, hidden: ["encyclopedia"] }),
    }),
  ).toEqual({ order, hidden: ["encyclopedia"] });
  const custom = moveMenu(previous, "encyclopedia", "artists");
  expect(
    readMenuPreferences({
      getItem: () => JSON.stringify({ version: 3, order: custom, hidden: [] }),
    }).order,
  ).toEqual(custom);
});

it("retains custom names without changing identities, order or hidden menus", () => {
  let raw: string | null = null;
  const store = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const initial = readMenuPreferences(store);
  saveMenuPreferences(store, {
    ...initial,
    hidden: ["radio"],
    labels: { doctor: "Santé musicale", "heading:tools": "Mon atelier" },
  });
  const restored = readMenuPreferences(store);
  expect(restored.labels).toEqual({ doctor: "Santé musicale", "heading:tools": "Mon atelier" });
  expect(restored.order).toEqual(initial.order);
  expect(restored.hidden).toEqual(["radio"]);
});
it("refuses labels on unknown identities, empty names or oversized text before writing", () => {
  const setItem = () => {
    throw new Error("Must not write");
  };
  for (const labels of [{ invalid: "Name" }, { albums: " " }, { albums: "x".repeat(81) }])
    expect(() =>
      saveMenuPreferences({ getItem: () => null, setItem }, { order: ids, hidden: [], labels }),
    ).toThrow("Configuration");
});

it("removes the retired recent menu from default and saved navigation without losing other customizations", () => {
  expect(sections.some((item) => String(item.id) === "recent")).toBe(false);
  const order = moveMenu(defaultMenuOrder(), "labels", "artists");
  const legacy = ["recent", ...order];
  const restored = readMenuPreferences({
    getItem: () =>
      JSON.stringify({
        version: 6,
        order: legacy,
        hidden: ["recent", "radio"],
        labels: { recent: "Ajouts", doctor: "Santé" },
      }),
  });
  expect(restored).toEqual({ order, hidden: ["radio"], labels: { doctor: "Santé" } });
});
it("migrates old flat recent-menu preferences and still rejects duplicated legacy entries", () => {
  const restored = readMenuPreferences({
    getItem: () =>
      JSON.stringify({ version: 1, order: ["recent", "albums", "artists"], hidden: ["recent"] }),
  });
  expect(restored.order.filter((id) => menuItem(id).kind === "section").slice(0, 2)).toEqual([
    "albums",
    "artists",
  ]);
  expect(restored.hidden).toEqual([]);
  expect(() =>
    readMenuPreferences({
      getItem: () => JSON.stringify({ version: 6, order: ["recent", "recent"], hidden: [] }),
    }),
  ).toThrow();
});
