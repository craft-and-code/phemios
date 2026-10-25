import { createSignal, Show } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { CoverPreviewView } from "../../../src/components/CoverPreviewView";
const title =
  "A fictional album with a deliberately very long title that extends far beyond the width of its portrait cover and must never displace it towards one side of the preview";
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"><rect width="320" height="480" fill="#304547"/><circle cx="160" cy="210" r="110" fill="#a4b556"/><text x="160" y="380" text-anchor="middle" fill="white" font-size="32">FICTIONAL</text></svg>')}`;
const meta = {
  title: "Media/CoverPreview",
  component: CoverPreviewView,
  args: {
    title,
    image,
    fallback: (
      <div class="artwork" role="img" aria-label="Fictional fallback">
        No resident cover
      </div>
    ),
    onClose: () => {},
  },
  render: (args) => {
    const [open, setOpen] = createSignal(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Agrandir la pochette</button>
        <Show when={open()}>
          <CoverPreviewView {...args} onClose={() => setOpen(false)} />
        </Show>
      </>
    );
  },
} satisfies Meta<typeof CoverPreviewView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LongTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      trigger = canvas.getByRole("button", { name: "Agrandir la pochette" });
    await userEvent.click(trigger);
    const dialog = canvas.getByRole("dialog"),
      heading = within(dialog).getByRole("heading"),
      cover = within(dialog).getByRole("img");
    expect(heading).toHaveFocus();
    const frame = dialog.getBoundingClientRect(),
      artwork = cover.getBoundingClientRect();
    expect(Math.abs(frame.left + frame.width / 2 - artwork.left - artwork.width / 2)).toBeLessThan(
      1,
    );
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
    const close = within(dialog).getByRole("button", { name: "Fermer la pochette" });
    expect(close.getBoundingClientRect().width).toBe(28);
    await userEvent.click(close);
    expect(canvas.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  },
};
export const MissingCover: Story = {
  args: { image: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      trigger = canvas.getByRole("button", { name: "Agrandir la pochette" });
    await userEvent.click(trigger);
    const dialog = canvas.getByRole("dialog"),
      frame = dialog.getBoundingClientRect(),
      cover = within(dialog).getByRole("img").getBoundingClientRect();
    expect(Math.abs(frame.left + frame.width / 2 - cover.left - cover.width / 2)).toBeLessThan(1);
    await fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(canvas.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  },
};
