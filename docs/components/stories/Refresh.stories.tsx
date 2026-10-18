import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { RefreshButton } from "../../../src/components/RefreshButton";
const meta = {
  title: "Controls/RefreshButton",
  component: RefreshButton,
  args: { busy: false, disabled: false, onRefresh: () => {} },
} satisfies Meta<typeof RefreshButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Cancel: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false),
      [result, setResult] = createSignal("Idle");
    return (
      <>
        <RefreshButton
          busy={busy()}
          onRefresh={() => {
            setBusy(true);
            setResult("Waiting");
          }}
          onCancel={() => {
            setBusy(false);
            setResult("Cancelled");
          }}
        />
        <output>{result()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      button = canvas.getByRole("button", { name: "Actualiser" });
    const before = button.getBoundingClientRect();
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-busy", "true");
    const spinner = button.querySelector(".spinner")!.getBoundingClientRect();
    expect(spinner.width).toBeGreaterThan(10);
    expect(Math.abs(spinner.width - spinner.height)).toBeLessThan(0.6);
    await userEvent.hover(button);
    expect(getComputedStyle(button.querySelector(".activity-stop")!).opacity).toBe("1");
    expect(button.getBoundingClientRect().width).toBe(before.width);
    await userEvent.click(button);
    await expect(canvas.getByText("Cancelled")).toBeVisible();
    await expect(button).not.toHaveAttribute("aria-busy");
  },
};

/** A synchronous read still gets one full turn without delaying the actual result. */
export const ImmediateRotation: Story = {
  args: { rotate: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    expect(button.querySelector(".refresh-rotating")).not.toBeNull();
    expect(getComputedStyle(button.querySelector(".refresh-glyph")!).animationDirection).toBe(
      "reverse",
    );
    expect(button.querySelector(".spinner")).toBeNull();
    expect(button).toBeDisabled();
    // A completed animation cycle, rather than request duration, retires the visual action.
    button
      .querySelector(".refresh-glyph")!
      .dispatchEvent(new Event("animationiteration", { bubbles: true }));
    expect(button.querySelector(".refresh-rotating")).toBeNull();
    expect(button).toBeEnabled();
  },
};
