import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CatalogActions } from "../../../src/components/CatalogActions";
import { Icon } from "../../../src/components/Icon";
import { createCatalogPresentation } from "../../../src/navigation/catalog-presentation";
const meta = {
  title: "Controls/CatalogActions",
  component: CatalogActions,
  args: { reverse: false, compact: false, onReverse: () => {}, onCompact: () => {} },
  render: () => {
    const [reverse, setReverse] = createSignal(false);
    const view = createCatalogPresentation(() => "albums");
    return (
      <CatalogActions
        reverse={reverse()}
        compact={view.value() === "list"}
        coverFlow={view.value() === "cover-flow"}
        onReverse={() => setReverse(!reverse())}
        onCompact={() => {
          view.select("list");
        }}
        onGrid={() => {
          view.select("grid");
        }}
        onCoverFlow={() => {
          view.select("cover-flow");
        }}
      >
        <button class="icon-button" aria-label="Collection">
          <Icon name="library" />
        </button>
      </CatalogActions>
    );
  },
} satisfies Meta<typeof CatalogActions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      buttons = canvas.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Inverser l’ordre alphabétique",
      "Vue compacte",
      "Vue en grille",
      "Cover Flow",
      "Collection",
    ]);
    expect(getComputedStyle(buttons[0]!.parentElement!).gap).toBe("8px");
    for (const button of buttons) {
      const box = button.getBoundingClientRect();
      expect(box.width).toBe(36);
      expect(box.height).toBe(36);
    }
    await userEvent.click(buttons[3]!);
    await expect(buttons[3]!).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(buttons[1]!);
    await expect(buttons[3]!).toHaveAttribute("aria-pressed", "false");
    await expect(buttons[1]!).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(buttons[2]!);
    await expect(buttons[1]!).toHaveAttribute("aria-pressed", "false");
    await expect(buttons[2]!).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(buttons[0]!);
    await expect(buttons[0]!).toHaveAttribute("aria-pressed", "true");
  },
};
