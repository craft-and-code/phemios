import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CatalogActions } from "../../../src/components/CatalogActions";
import { Icon } from "../../../src/components/Icon";
const meta = {
  title: "Controls/CatalogActions",
  component: CatalogActions,
  args: { reverse: false, compact: false, onReverse: () => {}, onCompact: () => {} },
  render: () => {
    const [reverse, setReverse] = createSignal(false),
      [compact, setCompact] = createSignal(false),
      [flow, setFlow] = createSignal(false);
    return (
      <CatalogActions
        reverse={reverse()}
        compact={compact()}
        coverFlow={flow()}
        onReverse={() => setReverse(!reverse())}
        onCompact={() => {
          setFlow(false);
          setCompact(!compact());
        }}
        onCoverFlow={() => {
          setCompact(false);
          setFlow(!flow());
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
      "Cover Flow",
      "Collection",
    ]);
    expect(getComputedStyle(buttons[0]!.parentElement!).gap).toBe("8px");
    for (const button of buttons) {
      const box = button.getBoundingClientRect();
      expect(box.width).toBe(36);
      expect(box.height).toBe(36);
    }
    await userEvent.click(buttons[2]!);
    await expect(buttons[2]!).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(buttons[1]!);
    await expect(buttons[2]!).toHaveAttribute("aria-pressed", "false");
    await expect(buttons[1]!).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(buttons[0]!);
    await expect(buttons[0]!).toHaveAttribute("aria-pressed", "true");
  },
};
