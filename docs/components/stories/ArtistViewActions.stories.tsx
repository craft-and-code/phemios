import { createSignal } from "solid-js";
import { expect, within, userEvent } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ArtistViewActions } from "../../../src/components/ArtistViewActions";
import type { ArtistView } from "../../../src/library/tool-preferences";
const meta = {
  title: "Catalog/ArtistViewActions",
  component: ArtistViewActions,
  args: { value: "discography", onChange: () => {} },
  render: () => {
    const [value, setValue] = createSignal<ArtistView>("discography");
    return <ArtistViewActions value={value()} onChange={setValue} />;
  },
} satisfies Meta<typeof ArtistViewActions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName("Ligne éditoriale");
    expect(buttons[1]).toHaveAccessibleName("Cartes d’artistes");
    expect(within(canvasElement).queryByRole("button", { name: "Portrait immersif" })).toBeNull();
    for (const button of buttons) {
      expect(button).toBeEnabled();
      await userEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(buttons.filter((item) => item.getAttribute("aria-pressed") === "true")).toHaveLength(
        1,
      );
      for (const other of buttons) expect(other).toBeEnabled();
    }
  },
};
