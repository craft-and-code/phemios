import { createRoot } from "solid-js";
import { expect, it } from "vitest";
import {
  addCollectionMenu,
  removeCollectionMenu,
  collectionMenuName,
  collectionMenuHref,
  reconcileCollectionMenus,
} from "./collection-menu";
import {
  createMenuPreferences,
  readMenuPreferences,
  saveMenuPreferences,
  defaultMenuOrder,
  menuLabel,
  visibleMenu,
} from "./menu-preferences";
import { createAccountPreferenceProfiles } from "../library/account-preferences";
const id = "collection:11111111-1111-4111-8111-111111111111" as const;
const other = "collection:22222222-2222-4222-8222-222222222222" as const;
function store() {
  let raw: string | null = null;
  return {
    getItem: () => raw,
    setItem: (_key: string, next: string) => {
      raw = next;
    },
  };
}
it("persists a movable, hideable, independently named collection menu without storing its rule", () => {
  const memory = store();
  let menu = addCollectionMenu(readMenuPreferences(memory), id, "Jazz / années 70", "Mon Jazz");
  menu = { ...menu, order: [id, ...menu.order.filter((key) => key !== id)], hidden: [id] };
  saveMenuPreferences(memory, menu);
  const restored = readMenuPreferences(memory);
  expect(restored.order[0]).toBe(id);
  expect(menuLabel(id, restored)).toBe("Mon Jazz");
  expect(collectionMenuName(restored, id)).toBe("Jazz / années 70");
  expect(visibleMenu(restored)).not.toContain(id);
  expect(collectionMenuHref(id)).not.toContain("Jazz");
  expect(memory.getItem()).not.toContain("expression");
});
it("removes only the chosen shortcut and its overrides while retaining another link to the same collection", () => {
  const first = addCollectionMenu({ order: defaultMenuOrder(), hidden: [] }, id, "Jazz", "Premier");
  const both = addCollectionMenu(first, other, "Jazz", "Second");
  const next = removeCollectionMenu({ ...both, hidden: [id] }, id);
  expect(next.order).not.toContain(id);
  expect(next.hidden).not.toContain(id);
  expect(next.labels?.[id]).toBeUndefined();
  expect(collectionMenuName(next, id)).toBeUndefined();
  expect(collectionMenuName(next, other)).toBe("Jazz");
  expect(collectionMenuName(both, id)).toBe("Jazz");
});
it("migrates the existing menu without resetting names, hidden sections or custom ordering", () => {
  const original = {
    version: 6,
    order: ["albums", "artists"],
    hidden: ["artists"],
    labels: { albums: "Disques" },
  };
  const memory = store();
  memory.setItem("", JSON.stringify(original));
  const old = readMenuPreferences(memory);
  saveMenuPreferences(memory, addCollectionMenu(old, id, "Jazz"));
  const next = readMenuPreferences(memory);
  expect(next.order.filter((key) => key !== id)).toEqual(old.order);
  expect(next.hidden).toEqual(old.hidden);
  expect(next.labels).toEqual(old.labels);
});
it("rejects orphan, malformed and oversized references before changing persisted data", () => {
  const memory = store();
  const valid = addCollectionMenu({ order: defaultMenuOrder(), hidden: [] }, id, "Jazz");
  saveMenuPreferences(memory, valid);
  const original = memory.getItem();
  for (const changed of [
    { ...valid, collections: {} },
    { ...valid, collections: { [id]: " " } },
    { ...valid, collections: { [id]: "é".repeat(129) } },
    { ...valid, collections: { [id]: "Jazz", [other]: "Orphan" } },
    { ...valid, order: [...valid.order, id] },
  ]) {
    expect(() => saveMenuPreferences(memory, changed)).toThrow();
    expect(memory.getItem()).toBe(original);
  }
});
it("never resolves a private shortcut from another active account profile", () => {
  const data = new Map<string, string>();
  const profiles = createAccountPreferenceProfiles({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  profiles.activate("alice");
  saveMenuPreferences(
    profiles.storage,
    addCollectionMenu({ order: defaultMenuOrder(), hidden: [] }, id, "Alice private"),
  );
  profiles.activate("bob");
  const bob = addCollectionMenu(readMenuPreferences(profiles.storage), other, "Alice private");
  saveMenuPreferences(profiles.storage, bob);
  expect(collectionMenuName(readMenuPreferences(profiles.storage), id)).toBeUndefined();
  profiles.activate("alice");
  expect(collectionMenuName(readMenuPreferences(profiles.storage), id)).toBe("Alice private");
});

it("keeps the visible menu unchanged when a shortcut write fails", () =>
  createRoot((dispose) => {
    const menu = createMenuPreferences({
      getItem: () => null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    const before = menu.value();
    expect(menu.update(() => addCollectionMenu(menu.value(), id, "Jazz"))).toBe(false);
    expect(menu.value()).toBe(before);
    expect(menu.error()).toContain("Quota exceeded");
    dispose();
  }));

const targetId = `collection-${"a".repeat(64)}`;
it("migrates legacy name pins once and thereafter follows immutable identity across both rename origins", () => {
  const memory = store();
  memory.setItem(
    "",
    JSON.stringify({
      version: 7,
      order: [id, other, "albums"],
      hidden: [other],
      labels: { [id]: "Alias", albums: "Disques" },
      collections: { [id]: "Jazz", [other]: "Jazz" },
    }),
  );
  const legacy = readMenuPreferences(memory);
  expect(menuLabel(id, legacy)).toBe("Alias");
  const bound = reconcileCollectionMenus(legacy, [{ id: targetId, name: "Jazz" }]);
  saveMenuPreferences(memory, bound);
  expect(JSON.parse(memory.getItem()!).version).toBe(9);
  expect(bound.collectionIds?.[id]).toBe(targetId);
  expect(bound.labels?.[id]).toBeUndefined();
  expect(bound.labels?.albums).toBe("Disques");
  for (const name of ["Renamed from menu", "Renamed from collections"]) {
    const renamed = reconcileCollectionMenus(bound, [{ id: targetId, name }]);
    expect(menuLabel(id, renamed)).toBe(name);
    expect(menuLabel(other, renamed)).toBe(name);
    expect(renamed.order).toEqual(bound.order);
    expect(renamed.hidden).toEqual(bound.hidden);
    expect(renamed.collectionIds).toEqual(bound.collectionIds);
  }
  const recreated = reconcileCollectionMenus(bound, [
    { id: `collection-${"b".repeat(64)}`, name: "Jazz" },
  ]);
  expect(recreated).toBe(bound);
  expect(recreated.collectionIds?.[id]).toBe(targetId);
});
it("rejects corrupt target IDs and orphan ID mappings without changing retained bytes", () => {
  const memory = store(),
    menu = addCollectionMenu(readMenuPreferences(memory), id, "Jazz", "", targetId);
  saveMenuPreferences(memory, menu);
  const original = memory.getItem();
  for (const collectionIds of [{ [id]: "bad" }, { [other]: targetId }, { [id]: 42 }]) {
    expect(() => saveMenuPreferences(memory, { ...menu, collectionIds } as never)).toThrow();
    expect(memory.getItem()).toBe(original);
  }
  const removed = removeCollectionMenu(menu, id);
  expect(removed.collectionIds?.[id]).toBeUndefined();
});
