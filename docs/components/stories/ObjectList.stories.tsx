import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within, fireEvent, waitFor } from "storybook/test";
import { ObjectList } from "../../../src/components/ObjectList";
import { objectListAfterRemoval, reorderObjects } from "../../../src/library/object-list";
import { createExcludedFolders } from "../../../src/library/excluded-folders";
const meta = {
  title: "Controls/ObjectList",
  component: ObjectList,
  args: {
    label: "Fictional exclusions",
    items: [],
    selected: undefined,
    onSelect: () => {},
    empty: "Aucun dossier exclu.",
  },
} satisfies Meta<typeof ObjectList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardAndRemoval: Story = {
  render: () => {
    const [items, setItems] = createSignal(["/music/a", "/music/b", "/music/c"]),
      [selected, setSelected] = createSignal<string>();
    let list!: HTMLUListElement;
    const remove = async () => {
      const held = selected();
      if (!held) return;
      const next = objectListAfterRemoval(items(), held);
      setItems(items().filter((item) => item !== held));
      setSelected(next);
      list.focus();
    };
    return (
      <section>
        <button
          aria-label="Retirer l’exclusion sélectionnée"
          disabled={!selected()}
          onClick={() => void remove()}
        >
          −
        </button>
        <ObjectList
          label="Fictional exclusions"
          items={items()}
          selected={selected()}
          onSelect={setSelected}
          empty="Aucun dossier exclu."
          listRef={(node) => {
            list = node;
          }}
          onDelete={remove}
          onReorder={(item, before) => {
            setItems(reorderObjects(items(), item, before));
          }}
        />
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      list = canvas.getByRole("listbox");
    await userEvent.click(list);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(canvas.getByRole("option", { name: "/music/b" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(within(list).getAllByRole("option")[0]).toHaveTextContent("/music/b");
    await userEvent.keyboard("{Delete}");
    await waitFor(() => expect(canvas.queryByRole("option", { name: "/music/b" })).toBeNull());
    expect(canvas.getByRole("option", { name: "/music/a" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Retirer l’exclusion sélectionnée" }));
    expect(list).toHaveFocus();
    expect(canvas.getByRole("option", { name: "/music/c" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => expect(canvas.queryAllByRole("option")).toHaveLength(0));
    const empty = canvas.getByText("Aucun dossier exclu.");
    const message = empty.getBoundingClientRect(),
      frame = list.getBoundingClientRect();
    expect(Math.abs(message.x + message.width / 2 - frame.x - frame.width / 2)).toBeLessThan(1);
    expect(Math.abs(message.y + message.height / 2 - frame.y - frame.height / 2)).toBeLessThan(1);
  },
};
export const DragAndScroll: Story = {
  render: () => {
    const [items, setItems] = createSignal(
        Array.from({ length: 12 }, (_, i) => `/music/${String(i + 1).padStart(2, "0")}`),
      ),
      [selected, setSelected] = createSignal<string>();
    return (
      <ObjectList
        label="Fictional exclusions"
        items={items()}
        selected={selected()}
        onSelect={setSelected}
        empty="Empty"
        onReorder={(item, before) => {
          setItems(reorderObjects(items(), item, before));
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      list = canvas.getByRole("listbox"),
      transfer = new DataTransfer();
    const first = canvas.getByRole("option", { name: "/music/01" }),
      second = canvas.getByRole("option", { name: "/music/02" });
    const grip = second.querySelector<HTMLElement>(".object-list-grip")!;
    fireEvent.dragStart(grip, { dataTransfer: transfer });
    const top = first.getBoundingClientRect().top;
    fireEvent.dragOver(first, { dataTransfer: transfer, clientY: top + 2 });
    expect(first).toHaveClass("list-drop-before");
    fireEvent.drop(first, { dataTransfer: transfer, clientY: top + 2 });
    fireEvent.dragEnd(grip, { dataTransfer: transfer });
    expect(first).not.toHaveClass("list-drop-before");
    expect(within(list).getAllByRole("option")[0]).toHaveTextContent("/music/02");
    await userEvent.click(list);
    await userEvent.keyboard("{End}");
    expect(list.scrollTop).toBeGreaterThan(0);
    expect(canvas.getByRole("option", { name: "/music/12" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(list.clientHeight).toBeLessThan(list.scrollHeight);
  },
};

export const GripOnlyDragging: Story = {
  render: DragAndScroll.render!,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      list = canvas.getByRole("listbox"),
      first = canvas.getByRole("option", { name: "/music/01" }),
      second = canvas.getByRole("option", { name: "/music/02" }),
      grip = first.querySelector<HTMLElement>(".object-list-grip")!,
      label = first.querySelector<HTMLElement>(".object-list-label")!,
      dataTransfer = new DataTransfer(),
      clientY = second.getBoundingClientRect().bottom - 2;
    for (const target of [first, label]) {
      fireEvent.dragStart(target, { dataTransfer });
      expect(first).not.toHaveClass("list-drag-source");
      fireEvent.dragOver(second, { dataTransfer, clientY });
      expect(list.querySelectorAll(".list-drop-before, .list-drop-after")).toHaveLength(0);
      fireEvent.drop(second, { dataTransfer, clientY });
      fireEvent.dragEnd(target, { dataTransfer });
      expect(within(list).getAllByRole("option")[0]).toBe(first);
    }
    expect(first.draggable).toBe(false);
    expect(grip.draggable).toBe(true);
    expect(getComputedStyle(first).cursor).toBe("default");
    expect(getComputedStyle(label).cursor).toBe("default");
    expect(getComputedStyle(grip).cursor).toBe("grab");
    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-selected", "true");
    fireEvent.dragStart(grip, { dataTransfer });
    expect(first).toHaveClass("list-drag-source");
    fireEvent.dragOver(second, { dataTransfer, clientY });
    expect(list.querySelectorAll(".list-drop-before, .list-drop-after")).toHaveLength(1);
    fireEvent.drop(second, { dataTransfer, clientY });
    fireEvent.dragEnd(grip, { dataTransfer });
    expect(within(list).getAllByRole("option")[0]).toBe(second);
    expect(within(list).getAllByRole("option")[1]).toBe(first);
    expect(list.querySelectorAll(".list-drop-before, .list-drop-after")).toHaveLength(0);
  },
};

export const MultipleSelection: Story = {
  render: () => {
    const paths = new Set(["/music/a", "/music/b", "/music/c"]);
    const folders = createExcludedFolders({
      session: () => ({
        server: "https://fixture.invalid",
        nativeSession: "qa",
        account: { id: "qa", username: "QA", role: "admin" },
      }),
      page: async () => ({
        items: [...paths].map((path) => ({ path, status: "excluded" })),
        total: paths.size,
        offset: 0,
        scanned_at: 1,
      }),
      pick: async () => [],
      change: async (path) => {
        paths.delete(path);
      },
    });
    return (
      <section>
        <button
          disabled={folders.busy() || !folders.selection()}
          onClick={() => void folders.remove()}
        >
          Remove selected exclusions
        </button>
        <ObjectList
          label="Fictional exclusions"
          items={folders.read.current() ?? []}
          selected={folders.selection()}
          selectedItems={folders.selections()}
          onSelect={folders.select}
          onSelectMany={folders.selectMany}
          onDelete={() => folders.remove()}
          disabled={folders.busy() || folders.read.pending()}
          empty="Aucun dossier exclu."
        />
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      list = canvas.getByRole("listbox");
    await waitFor(() => expect(canvas.getAllByRole("option")).toHaveLength(3));
    expect(list).toHaveAttribute("aria-multiselectable", "true");
    await userEvent.click(canvas.getByRole("option", { name: "/music/b" }));
    fireEvent.keyDown(list, { key: "a", ctrlKey: true });
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(3);
    await userEvent.keyboard("{ArrowDown}");
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(1);
    fireEvent.keyDown(list, { key: "a", metaKey: true });
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(3);
    fireEvent.click(canvas.getByRole("option", { name: "/music/a" }), { ctrlKey: true });
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "Remove selected exclusions" }));
    await waitFor(() => expect(canvas.getAllByRole("option")).toHaveLength(1));
    await userEvent.click(list);
    fireEvent.keyDown(list, { key: "a", ctrlKey: true });
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => expect(canvas.queryAllByRole("option")).toHaveLength(0));
    expect(list).toHaveFocus();
  },
};

export const RangeSelection: Story = {
  render: MultipleSelection.render!,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      list = canvas.getByRole("listbox");
    await waitFor(() => expect(canvas.getAllByRole("option")).toHaveLength(3));
    await userEvent.click(canvas.getByRole("option", { name: "/music/b" }));
    fireEvent.click(canvas.getByRole("option", { name: "/music/c" }), { shiftKey: true });
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(2);
    expect(list).toHaveAttribute(
      "aria-activedescendant",
      canvas.getByRole("option", { name: "/music/c" }).id,
    );
    await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(1);
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    expect(canvas.getByRole("option", { name: "/music/a" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Shift>}{End}{/Shift}");
    expect(canvas.getByRole("option", { name: "/music/a" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    fireEvent.click(canvas.getByRole("option", { name: "/music/a" }), {
      ctrlKey: true,
      shiftKey: true,
    });
    expect(canvas.getAllByRole("option", { selected: true })).toHaveLength(3);
    await userEvent.keyboard("{Delete}");
    await waitFor(() => expect(canvas.queryAllByRole("option")).toHaveLength(0));
  },
};
