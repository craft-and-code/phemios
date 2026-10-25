import { expect, it } from "vitest";
import { dropCollectionMenu } from "./collection-menu-drop";
import type { MenuPreferences } from "./menu-preferences";
const id = "collection:11111111-1111-4111-8111-111111111111" as const;
it("inserts a captured collection before the intended menu or appends at the tail", () => {
  const value: MenuPreferences = { order: ["artists", "albums"], hidden: [] },
    identity = {};
  const drag = { identity, name: "Jazz", label: "Mon Jazz" };
  expect(dropCollectionMenu(value, drag, identity, ["Jazz"], id, "albums").order).toEqual([
    "artists",
    id,
    "albums",
  ]);
  const next = dropCollectionMenu(value, drag, identity, ["Jazz"], id);
  expect(next.order).toEqual(["artists", "albums", id]);
  expect(next.labels?.[id]).toBe("Mon Jazz");
  expect(value.order).toEqual(["artists", "albums"]);
});
it("rejects replaced scopes, removed collections and obsolete drop targets without touching preferences", () => {
  const value: MenuPreferences = { order: ["artists"], hidden: [] },
    identity = {};
  const drag = { identity, name: "Jazz", label: "" };
  expect(dropCollectionMenu(value, drag, {}, ["Jazz"], id)).toBe(value);
  expect(dropCollectionMenu(value, drag, identity, [], id)).toBe(value);
  expect(dropCollectionMenu(value, drag, identity, ["Jazz"], id, "albums")).toBe(value);
});

it("revalidates immutable targets when a collection was deleted and its name reused during drag", () => {
  const value: MenuPreferences = { order: ["albums"], hidden: [] },
    identity = {};
  const targetId = `collection-${"a".repeat(64)}`,
    drag = { identity, name: "Jazz", label: "", targetId };
  const next = dropCollectionMenu(value, drag, identity, ["Jazz"], id, undefined, [
    { id: targetId, name: "Jazz" },
  ]);
  expect(next.collectionIds?.[id]).toBe(targetId);
  expect(
    dropCollectionMenu(value, drag, identity, ["Jazz"], id, undefined, [
      { id: `collection-${"b".repeat(64)}`, name: "Jazz" },
    ]),
  ).toBe(value);
});
