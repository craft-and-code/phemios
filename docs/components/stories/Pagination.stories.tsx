import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { Pagination } from "../../../src/components/Pagination";
const meta = {
  title: "Controls/Pagination",
  component: Pagination,
  args: { offset: 0, size: 50, total: 112, count: 50, busy: false, onOffset: () => {} },
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;
export const First: Story = {};
export const Last: Story = { args: { offset: 100, count: 12 } };
export const Busy: Story = { args: { offset: 50, busy: true } };
export const Navigation: Story = {
  render: (args) => {
    const [offset, setOffset] = createSignal(0);
    return (
      <Pagination
        {...args}
        offset={offset()}
        count={Math.min(args.size, args.total - offset())}
        onOffset={setOffset}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      prev = canvas.getByRole("button", { name: "Précédent" }),
      next = canvas.getByRole("button", { name: "Suivant" });
    expect(prev).toBeDisabled();
    expect(canvas.getByText("1–50 / 112")).toBeVisible();
    await userEvent.click(next);
    expect(prev).toBeEnabled();
    expect(canvas.getByText("51–100 / 112")).toBeVisible();
    await userEvent.click(next);
    expect(next).toBeDisabled();
    expect(canvas.getByText("101–112 / 112")).toBeVisible();
    await userEvent.click(prev);
    expect(canvas.getByText("51–100 / 112")).toBeVisible();
    const nav = canvasElement.querySelector(".pagination-controls")!;
    expect(getComputedStyle(nav).gap).toBe("8px");
    expect(getComputedStyle(nav).paddingBottom).toBe("24px");
    for (const button of nav.querySelectorAll("button")) {
      expect(button.getBoundingClientRect().width).toBe(36);
      expect(button.getBoundingClientRect().height).toBe(36);
    }
  },
};
