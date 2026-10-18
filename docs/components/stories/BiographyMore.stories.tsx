import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { BiographyMore } from "../../../src/components/BiographyMore";
const meta = {
  title: "Catalog/BiographyMore",
  component: BiographyMore,
  args: { busy: false, disabled: false, onOpen: () => {} },
  render: (args) => {
    const [busy, setBusy] = createSignal(args.busy);
    return (
      <section class="biography">
        <p>
          Un résumé fictif se termine ici.
          <BiographyMore {...args} busy={busy()} onOpen={() => setBusy(true)} />
        </p>
        <small>Source · licence</small>
      </section>
    );
  },
} satisfies Meta<typeof BiographyMore>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InlineActivity: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Lire plus" });
    expect(button.closest("p")).not.toBeNull();
    const before = button.querySelector(".biography-more-icon")!.getBoundingClientRect();
    await userEvent.click(button);
    expect(button).toBeDisabled();
    const spinner = button.querySelector(".spinner")!.getBoundingClientRect();
    expect(Math.abs(spinner.y + spinner.height / 2 - before.y - before.height / 2)).toBeLessThan(1);
    expect(getComputedStyle(button.querySelector(".spinner")!).width).toBe(`${before.width}px`);
    expect(button.querySelector("svg")).toBeNull();
  },
};
