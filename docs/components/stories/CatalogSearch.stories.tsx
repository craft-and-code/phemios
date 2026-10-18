import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal, For } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Section } from "../../../src/navigation/routes";
import { CatalogSearch } from "../../../src/components/CatalogSearch";
const meta = {
  title: "Controls/CatalogSearch",
  component: CatalogSearch,
  args: { value: "", onInput: () => {}, section: "albums" },
  render: () => {
    const [scope, setScope] = createSignal<Section>("albums"),
      [values, setValues] = createSignal<Partial<Record<Section, string>>>({});
    return (
      <>
        <CatalogSearch
          section={scope()}
          value={values()[scope()] ?? ""}
          onInput={(value) => setValues({ ...values(), [scope()]: value })}
        />
        <div class="component-controls">
          <For each={["albums", "tags", "favourites", "moods", "playlists"] as const}>
            {(name) => <button onClick={() => setScope(name)}>{name}</button>}
          </For>
        </div>
      </>
    );
  },
} satisfies Meta<typeof CatalogSearch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ContextAndRetainedQueries: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Rechercher dans tous les champs du catalogue" }),
      "Morning",
    );
    await userEvent.click(canvas.getByRole("button", { name: "tags" }));
    const tags = canvas.getByRole("searchbox", { name: "Rechercher un tag" });
    expect(tags).toHaveValue("");
    await userEvent.type(tags, "music");
    await userEvent.click(canvas.getByRole("button", { name: "favourites" }));
    expect(canvas.getByRole("searchbox", { name: "Rechercher dans les favoris" })).toHaveAttribute(
      "placeholder",
      "Rechercher dans les favoris",
    );
    await userEvent.click(canvas.getByRole("button", { name: "albums" }));
    expect(
      canvas.getByRole("searchbox", { name: "Rechercher dans tous les champs du catalogue" }),
    ).toHaveValue("Morning");
    await userEvent.click(canvas.getByRole("button", { name: "tags" }));
    expect(canvas.getByRole("searchbox", { name: "Rechercher un tag" })).toHaveValue("music");
    expect(canvas.getByRole("link", { name: "Recherche avancée" })).toHaveAttribute(
      "href",
      "#/advanced-search",
    );
  },
};
