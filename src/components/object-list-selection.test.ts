import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it } from "vitest";
import { createObjectListSelection } from "./object-list-selection";
let dispose: () => void;
afterEach(() => dispose?.());
function fixture(multiple = true) {
  const [items, setItems] = createSignal(["a", "b", "c", "d", "e"]);
  const [selected, setSelected] = createSignal<readonly string[]>([]);
  const [identity, setIdentity] = createSignal<unknown>({ account: "first" });
  const [disabled, setDisabled] = createSignal(false);
  const selectMany = (ids: readonly string[]) => setSelected(ids);
  const selection = createRoot((end) => {
    dispose = end;
    return createObjectListSelection({
      get items() {
        return items();
      },
      get selected() {
        return selected()[0];
      },
      get selectedItems() {
        return multiple ? selected() : undefined;
      },
      get identity() {
        return identity();
      },
      get disabled() {
        return disabled();
      },
      onSelect: (id) => setSelected([id]),
      onSelectMany: multiple ? selectMany : undefined,
    });
  });
  return { selection, selected, setItems, setIdentity, setDisabled, setSelected };
}
it("extends, shrinks and reverses Shift-click ranges from the original anchor", () => {
  const { selection, selected } = fixture();
  selection.click("b", {});
  selection.click("e", { shiftKey: true });
  expect(selected()).toEqual(["b", "c", "d", "e"]);
  expect(selection.active()).toBe("e");
  selection.click("c", { shiftKey: true });
  expect(selected()).toEqual(["b", "c"]);
  selection.click("a", { shiftKey: true });
  expect(selected()).toEqual(["a", "b"]);
});
it("keeps keyboard focus independent of the first selected row for Shift arrows/Home/End", () => {
  const { selection, selected } = fixture();
  selection.click("b", {});
  selection.move("ArrowDown", { shiftKey: true });
  selection.move("ArrowDown", { shiftKey: true });
  expect(selected()).toEqual(["b", "c", "d"]);
  expect(selection.active()).toBe("d");
  selection.move("ArrowUp", { shiftKey: true });
  expect(selected()).toEqual(["b", "c"]);
  selection.move("Home", { shiftKey: true });
  expect(selected()).toEqual(["a", "b"]);
  selection.move("End", { shiftKey: true });
  expect(selected()).toEqual(["b", "c", "d", "e"]);
  selection.move("ArrowUp", {});
  expect(selected()).toEqual(["d"]);
});
it.each(["ctrlKey", "metaKey"])("toggles rows and adds Shift ranges with %s", (modifier) => {
  const { selection, selected } = fixture();
  selection.click("a", {});
  selection.click("c", { [modifier]: true });
  expect(selected()).toEqual(["a", "c"]);
  selection.click("e", { [modifier]: true, shiftKey: true });
  expect(selected()).toEqual(["a", "c", "d", "e"]);
  selection.click("c", { [modifier]: true });
  expect(selected()).toEqual(["a", "d", "e"]);
  selection.click("b", {});
  expect(selected()).toEqual(["b"]);
  expect(selection.all()).toBe(true);
  expect(selected()).toEqual(["a", "b", "c", "d", "e"]);
});
it("retires anchors on owner replacement and recovers when focused rows disappear", () => {
  const { selection, selected, setIdentity, setSelected, setItems } = fixture();
  selection.click("b", {});
  selection.click("e", { shiftKey: true });
  setItems(["a", "b", "c"]);
  setSelected(["b", "c"]);
  selection.move("ArrowDown", { shiftKey: true });
  expect(selected()).toEqual(["b", "c"]);
  setIdentity({ account: "replacement" });
  setSelected([]);
  selection.click("c", { shiftKey: true });
  expect(selected()).toEqual(["c"]);
});
it("does not admit unknown rows, disabled interactions or multi-selection in single mode", () => {
  const { selection, selected, setDisabled } = fixture(false);
  selection.click("b", {});
  selection.click("e", { shiftKey: true });
  expect(selected()).toEqual(["e"]);
  expect(selection.all()).toBe(false);
  selection.click("foreign", {});
  expect(selected()).toEqual(["e"]);
  setDisabled(true);
  selection.click("a", {});
  selection.move("Home", {});
  expect(selected()).toEqual(["e"]);
});
