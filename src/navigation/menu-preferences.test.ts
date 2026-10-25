import { expect, it } from "vitest";
import {
  readMenuPreferences,
  saveMenuPreferences,
  moveMenu,
  defaultMenuOrder,
  menuItem,
  menuLabel,
  visibleMenu,
  renameMenuItem,
  removeMenuSpacer,
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

it("inserts the new composers menu between existing genres and labels without resetting custom order", () => {
  const value = readMenuPreferences({
    getItem: () =>
      JSON.stringify({ version: 6, order: ["albums", "genres", "labels", "artists"], hidden: [] }),
  });
  expect(
    value.order.slice(value.order.indexOf("genres"), value.order.indexOf("genres") + 3),
  ).toEqual(["genres", "composers", "labels"]);
});

it("inserts local CD playback before Concerts in default and existing source menus", () => {
  const defaults = defaultMenuOrder();
  expect(defaults.indexOf("cd")).toBe(defaults.indexOf("concerts") - 1);
  const store = {
    getItem: () =>
      JSON.stringify({ version: 6, order: defaults.filter((id) => id !== "cd"), hidden: [] }),
  };
  const next = readMenuPreferences(store);
  expect(next.order.indexOf("cd")).toBe(next.order.indexOf("concerts") - 1);
  expect(next.order.filter((id) => id === "cd")).toHaveLength(1);
});

it("persists a named spacer as a literal group heading and retains unnamed spacers", () => {
  let raw: string | null = null;
  const store = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const value = {
    order: [...defaultMenuOrder(), "separator:named" as const, "separator:blank" as const],
    hidden: [],
    labels: { "separator:named": "  Mes favoris  " },
  };
  saveMenuPreferences(store, value);
  const restored = readMenuPreferences(store);
  expect(menuItem("separator:named", restored).kind).toBe("heading");
  expect(menuLabel("separator:named", restored)).toBe("Mes favoris");
  expect(menuItem("separator:blank", restored).kind).toBe("separator");
  expect(restored.order).toEqual(value.order);
  expect(visibleMenu(restored)).toContain("separator:named");
});

it("clears a spacer name back to blank and deletes its label without orphaning the store", () => {
  let raw: string | null = null;
  const store = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const initial = {
    order: [...defaultMenuOrder(), "separator:custom" as const],
    hidden: ["separator:custom" as const],
  };
  const named = saveMenuPreferences(store, renameMenuItem(initial, "separator:custom", "Jazz"));
  const blank = saveMenuPreferences(store, renameMenuItem(named, "separator:custom", "   "));
  expect(blank.labels?.["separator:custom"]).toBeUndefined();
  expect(menuItem("separator:custom", blank).kind).toBe("separator");
  const renamed = saveMenuPreferences(
    store,
    renameMenuItem(blank, "separator:custom", "Classique"),
  );
  saveMenuPreferences(store, removeMenuSpacer(renamed, "separator:custom"));
  expect(readMenuPreferences(store).order).not.toContain("separator:custom");
  expect(readMenuPreferences(store).hidden).not.toContain("separator:custom");
  expect(readMenuPreferences(store).labels?.["separator:custom"]).toBeUndefined();
});

it("preserves old spacer positions and refuses invalid new heading labels without replacing bytes", () => {
  let raw = JSON.stringify({
    version: 8,
    order: [...defaultMenuOrder(), "separator:custom"],
    hidden: ["albums"],
    labels: { artists: "Artistes préférés" },
  });
  const store = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const old = readMenuPreferences(store);
  const migrated = saveMenuPreferences(
    store,
    renameMenuItem(old, "separator:custom", "Mes disques"),
  );
  expect(JSON.parse(raw).version).toBe(9);
  expect(migrated.order).toEqual(old.order);
  expect(migrated.hidden).toEqual(old.hidden);
  expect(migrated.labels?.artists).toBe("Artistes préférés");
  for (const bad of ["x".repeat(81), "Bad" + String.fromCharCode(0) + "name"]) {
    const retained = raw;
    expect(() =>
      saveMenuPreferences(store, renameMenuItem(migrated, "separator:custom", bad)),
    ).toThrow();
    expect(raw).toBe(retained);
  }
});
