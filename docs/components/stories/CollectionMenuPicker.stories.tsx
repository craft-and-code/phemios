import { createSignal, For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within, fireEvent } from "storybook/test";
import { dropCollectionMenu } from "../../../src/navigation/collection-menu-drop";
import { CollectionMenuPicker } from "../../../src/components/CollectionMenuPicker";
import type { MenuPreferences } from "../../../src/navigation/menu-preferences";
import { collectionMenuHref, isCollectionMenuId } from "../../../src/navigation/collection-menu";
import { t } from "../../../src/i18n";
const meta = {
  title: "Settings/CollectionMenuPicker",
  component: CollectionMenuPicker,
  args: {
    menu: {
      value: () => ({ order: ["collections"], hidden: [] }),
      error: () => "",
      update: () => false,
      reset: () => {},
    },
  },
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof CollectionMenuPicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = createSignal<MenuPreferences>({ order: ["collections"], hidden: [] });
    const empty = () => setValue({ order: ["collections"], hidden: [] });
    const menu = {
      value,
      error: () => "",
      reset: empty,
      update: (next: MenuPreferences | (() => MenuPreferences)) => {
        setValue(typeof next === "function" ? next() : next);
        return true;
      },
    };
    const scope = {
      source: "local" as const,
      session: {
        server: "http://127.0.0.1:9000",
        account: { id: "fictional", username: "Fictional", role: "user" as const },
      },
    };
    let dragged: { name: string; label: string; identity: unknown } | undefined;
    return (
      <section class="settings-card">
        <h2>{t("Navigation")}</h2>
        <CollectionMenuPicker
          menu={menu}
          onCollectionDrag={(name, label) => {
            dragged = { name, label, identity: scope };
          }}
          onCollectionDragEnd={() => {
            dragged = undefined;
          }}
          choices={{
            identity: () => scope,
            names: () => ["Jazz des années 70", "Concerts en haute résolution"],
            rows: () =>
              ["Jazz des années 70", "Concerts en haute résolution"].map((name, i) => ({
                id: `collection-${String(i).repeat(64)}`,
                name,
              })),
            loading: () => false,
            error: () => "",
            refresh: () => undefined,
          }}
        />
        <nav
          aria-label="Added collection menus"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragged)
              menu.update(() =>
                dropCollectionMenu(
                  value(),
                  dragged!,
                  scope,
                  ["Jazz des années 70", "Concerts en haute résolution"],
                  `collection:${crypto.randomUUID()}`,
                  "collections",
                ),
              );
            dragged = undefined;
          }}
        >
          <For each={value().order.filter(isCollectionMenuId)}>
            {(id) => (
              <a href={collectionMenuHref(id)}>
                {value().labels?.[id] ?? value().collections?.[id]}
              </a>
            )}
          </For>
        </nav>
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Ajouter au menu") })).toBeDisabled();
    const list = canvas.getByRole("listbox", { name: t("Collections disponibles") });
    await userEvent.click(within(list).getByRole("option", { name: "Jazz des années 70" }));
    expect(within(list).getByRole("option", { name: "Jazz des années 70" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(canvas.queryByRole("textbox", { name: t("Nom du menu") })).toBeNull();
    expect(canvas.queryByRole("button", { name: t("Actualiser les collections") })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: t("Ajouter au menu") }));
    expect(canvas.getByRole("link", { name: "Jazz des années 70" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^#\/collection\/[0-9a-f-]{36}$/),
    );
    expect(canvas.getByRole("button", { name: t("Ajouter au menu") })).toBeDisabled();
  },
};

export const DragToMenu: Story = {
  render: Interactive.render!,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      source = canvas.getByRole("option", { name: "Jazz des années 70" });
    const target = canvas.getByRole("navigation", { name: "Added collection menus" }),
      transfer = new DataTransfer();
    const grip = source.querySelector<HTMLElement>(".object-list-grip")!;
    fireEvent.dragStart(grip, { dataTransfer: transfer });
    fireEvent.dragOver(target, { dataTransfer: transfer });
    fireEvent.drop(target, { dataTransfer: transfer });
    fireEvent.dragEnd(grip, { dataTransfer: transfer });
    expect(within(target).getByRole("link", { name: "Jazz des années 70" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^#\/collection\/[0-9a-f-]{36}$/),
    );
  },
};

export const AddSeveralCollections: Story = {
  render: Interactive.render!,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("listbox", { name: t("Collections disponibles") });
    await userEvent.click(within(list).getByRole("option", { name: "Jazz des années 70" }));
    fireEvent.click(within(list).getByRole("option", { name: "Concerts en haute résolution" }), {
      shiftKey: true,
    });
    expect(within(list).getAllByRole("option", { selected: true })).toHaveLength(2);
    await userEvent.click(
      canvas.getByRole("button", { name: t("Ajouter les {0} collections au menu", "2") }),
    );
    const added = canvas.getByRole("navigation", { name: "Added collection menus" });
    expect(within(added).getAllByRole("link")).toHaveLength(2);
    expect(canvas.getByRole("button", { name: t("Ajouter au menu") })).toBeDisabled();
  },
};

export const ReorderAvailableCollections: Story = {
  render: Interactive.render!,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      list = canvas.getByRole("listbox", { name: t("Collections disponibles") }),
      first = within(list).getByRole("option", { name: "Jazz des années 70" }),
      second = within(list).getByRole("option", { name: "Concerts en haute résolution" }),
      dataTransfer = new DataTransfer(),
      clientY = first.getBoundingClientRect().top + 2;
    const grip = second.querySelector<HTMLElement>(".object-list-grip")!;
    fireEvent.dragStart(grip, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer, clientY });
    expect(first).toHaveClass("list-drop-before");
    expect(list.querySelectorAll(".list-drop-before, .list-drop-after")).toHaveLength(1);
    fireEvent.drop(first, { dataTransfer, clientY });
    fireEvent.dragEnd(grip, { dataTransfer });
    expect(within(list).getAllByRole("option")[0]).toBe(second);
    expect(list.querySelectorAll(".list-drop-before, .list-drop-after")).toHaveLength(0);
    const added = canvas.getByRole("navigation", { name: "Added collection menus" });
    expect(within(added).queryAllByRole("link")).toHaveLength(0);
    fireEvent.click(first, { shiftKey: true });
    await userEvent.click(
      canvas.getByRole("button", { name: t("Ajouter les {0} collections au menu", "2") }),
    );
    expect(
      within(added)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Concerts en haute résolution", "Jazz des années 70"]);
  },
};
