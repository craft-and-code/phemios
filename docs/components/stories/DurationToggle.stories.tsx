import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { DurationToggle } from "../../../src/components/DurationToggle";
const meta = {
  title: "Media/DurationToggle",
  component: DurationToggle,
  args: { duration: null, position: 30000, remaining: false, onToggle: () => {} },
} satisfies Meta<typeof DurationToggle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("—");
    expect(getComputedStyle(button).cursor).toBe("default");
  },
};
export const Finite: Story = {
  render: () => {
    const [remaining, setRemaining] = createSignal(false);
    return (
      <DurationToggle
        duration={120000}
        position={30000}
        remaining={remaining()}
        onToggle={() => setRemaining(!remaining())}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    expect(button).toHaveTextContent("2:00");
    await userEvent.click(button);
    expect(button).toHaveTextContent("−1:30");
  },
};
