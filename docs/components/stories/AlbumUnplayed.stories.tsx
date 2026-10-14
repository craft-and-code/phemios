import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { AlbumUnplayed } from "../../../src/components/AlbumUnplayed";
const meta = {
  title: "Media/AlbumUnplayed",
  component: AlbumUnplayed,
  args: { visible: true },
  render: (args) => (
    <div class="artwork" style={{ width: "180px", height: "180px" }}>
      <AlbumUnplayed {...args} />
    </div>
  ),
} satisfies Meta<typeof AlbumUnplayed>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unconfirmed: Story = {};
export const Complete: Story = { args: { visible: false } };
export const Completion: Story = {
  render: () => {
    const [completed, setCompleted] = createSignal(false);
    return (
      <div>
        <div class="artwork" style={{ width: "180px", height: "180px" }}>
          <AlbumUnplayed visible={!completed()} />
        </div>
        <button onClick={() => setCompleted(true)}>Confirm complete album</button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const marker = canvas.getByRole("img", { name: "Album pas encore écouté intégralement" });
    expect(marker).toBeVisible();
    expect(getComputedStyle(marker).pointerEvents).toBe("none");
    await userEvent.click(canvas.getByRole("button", { name: "Confirm complete album" }));
    expect(canvas.queryByRole("img")).toBeNull();
  },
};
