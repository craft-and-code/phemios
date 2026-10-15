import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import { RecentAlbumsFilter } from "../../../src/components/RecentAlbumsFilter";
import { CoverSize } from "../../../src/components/CoverSize";
const meta = {
  title: "Catalog/RecentAlbumsFilter",
  component: RecentAlbumsFilter,
  args: { active: false, onToggle: () => {} },
} satisfies Meta<typeof RecentAlbumsFilter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Toggle: Story = {
  render: () => {
    const [active, setActive] = createSignal(false);
    return (
      <div class="component-controls">
        <RecentAlbumsFilter active={active()} onToggle={() => setActive(!active())} />
        <CoverSize disabled={false} value={150} resetValue={150} onChange={() => {}} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      toggle = canvas.getByRole("button", { name: "Ajoutés ces 30 derniers jours" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    const slider = canvas.getByRole("slider", { name: "Taille des pochettes" });
    expect(toggle.getBoundingClientRect().right).toBeLessThan(slider.getBoundingClientRect().left);
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  },
};
