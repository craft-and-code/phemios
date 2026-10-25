import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createCollectionMenuSelection } from "./collection-menu-selection";
import { createMenuPreferences } from "../navigation/menu-preferences";
const first = { id: `collection-${"1".repeat(64)}`, name: "Jazz" };
const second = { id: `collection-${"2".repeat(64)}`, name: "Rock" };
let dispose: () => void;
afterEach(() => dispose?.());
function fixture() {
  let raw: string | null = null;
  const write = vi.fn((_key: string, next: string) => {
    raw = next;
  });
  const [rows, setRows] = createSignal([first, second]);
  const [identity, setIdentity] = createSignal<unknown>({ account: "first" });
  const [loading, setLoading] = createSignal(false);
  const result = createRoot((end) => {
    dispose = end;
    const menu = createMenuPreferences({ getItem: () => raw, setItem: write });
    const choices = { rows, identity, loading };
    return { menu, selection: createCollectionMenuSelection({ menu, choices: () => choices }) };
  });
  return { ...result, rows, setRows, identity, setIdentity, setLoading, write, raw: () => raw };
}
it("adds a deduplicated selection in directory order with one persisted update and stable targets", () => {
  const { selection, menu, write } = fixture();
  const before = menu.value().order.length;
  selection.selectMany([second.id, first.id, second.id]);
  expect(selection.add()).toBe(true);
  expect(write).toHaveBeenCalledTimes(1);
  const added = menu.value().order.slice(before);
  expect(added.map((id) => menu.value().collections?.[id as `collection:${string}`])).toEqual([
    "Jazz",
    "Rock",
  ]);
  expect(added.map((id) => menu.value().collectionIds?.[id as `collection:${string}`])).toEqual([
    first.id,
    second.id,
  ]);
  expect(selection.selections()).toEqual([]);
});
it("preserves the whole menu and selection when writing the group fails", () => {
  const { selection, menu, write, raw } = fixture();
  selection.selectMany([first.id, second.id]);
  const before = menu.value(),
    bytes = raw();
  write.mockImplementationOnce(() => {
    throw new Error("Quota exceeded");
  });
  expect(selection.add()).toBe(false);
  expect(menu.value()).toBe(before);
  expect(raw()).toBe(bytes);
  expect(selection.selections()).toEqual([first.id, second.id]);
  expect(menu.error()).toContain("Quota exceeded");
});
it("rejects an oversized group without saving a prefix", () => {
  const { selection, menu, write } = fixture();
  menu.update({
    ...menu.value(),
    order: [
      ...menu.value().order,
      ...Array.from(
        { length: 95 - menu.value().order.length },
        (_, i) => `separator:qa-${i}` as const,
      ),
    ],
  });
  write.mockClear();
  const before = menu.value();
  selection.selectMany([first.id, second.id]);
  expect(selection.add()).toBe(false);
  expect(menu.value()).toBe(before);
  expect(write).not.toHaveBeenCalled();
  expect(menu.error()).not.toBe("");
});
it("follows a selected ID through rename and never adopts a recreated name or another owner", () => {
  const { selection, menu, setRows, setIdentity, write } = fixture();
  selection.selectMany([first.id]);
  setRows([{ ...first, name: "Renamed" }, second]);
  expect(selection.add()).toBe(true);
  expect(Object.values(menu.value().collections ?? {})).toContain("Renamed");
  selection.selectMany([first.id]);
  setRows([{ id: `collection-${"3".repeat(64)}`, name: "Renamed" }, second]);
  write.mockClear();
  expect(selection.add()).toBe(false);
  expect(write).not.toHaveBeenCalled();
  selection.selectMany([second.id]);
  setIdentity({ account: "successor" });
  expect(selection.add()).toBe(false);
  expect(selection.selections()).toEqual([]);
});
it("refuses adding while the directory is loading", () => {
  const { selection, setLoading, write } = fixture();
  selection.selectMany([first.id, second.id]);
  setLoading(true);
  expect(selection.add()).toBe(false);
  expect(write).not.toHaveBeenCalled();
});
it("reorders available collections without writing menus and adds a group in displayed order", () => {
  const { selection, menu, write } = fixture();
  selection.selectMany([first.id, second.id]);
  selection.reorder(second.id, first.id);
  expect(selection.rows()).toEqual([second, first]);
  expect(selection.selections()).toEqual([second.id, first.id]);
  expect(write).not.toHaveBeenCalled();
  const before = menu.value().order.length;
  expect(selection.add()).toBe(true);
  const added = menu.value().order.slice(before);
  expect(added.map((id) => menu.value().collectionIds?.[id as `collection:${string}`])).toEqual([
    second.id,
    first.id,
  ]);
  expect(write).toHaveBeenCalledTimes(1);
});
it("retains presentation order through rename, appends new IDs and retires it across owners", () => {
  const { selection, setRows, rows, identity, setIdentity, setLoading, write } = fixture();
  const originalOwner = identity();
  selection.reorder(second.id, first.id);
  const renamed = { ...first, name: "Renamed" };
  const third = { id: `collection-${"3".repeat(64)}`, name: "New collection" };
  setRows([renamed, second, third]);
  expect(selection.rows()).toEqual([second, renamed, third]);
  selection.reorder(second.id);
  expect(selection.rows()).toEqual([renamed, third, second]);
  setLoading(true);
  selection.reorder(second.id, first.id);
  expect(selection.rows()).toEqual([renamed, third, second]);
  setLoading(false);
  selection.reorder("missing", first.id);
  selection.reorder(first.id, "missing");
  expect(selection.rows()).toEqual([renamed, third, second]);
  setRows([third, second]);
  expect(selection.rows()).toEqual([third, second]);
  selection.selectMany([second.id]);
  setIdentity({ account: "successor" });
  expect(selection.rows()).toEqual(rows());
  expect(selection.selections()).toEqual([]);
  setRows([first, second]);
  expect(selection.rows()).toEqual([first, second]);
  setIdentity(originalOwner);
  expect(selection.rows()).toEqual([first, second]);
  expect(selection.selections()).toEqual([]);
  expect(write).not.toHaveBeenCalled();
});
it("does not reorder available collections without an active directory owner", () => {
  const { selection, setIdentity, write } = fixture();
  setIdentity(undefined);
  selection.reorder(second.id, first.id);
  expect(selection.rows()).toEqual([first, second]);
  expect(write).not.toHaveBeenCalled();
});
