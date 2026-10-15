import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import { QueueClearButton } from "../../../src/components/QueueClearButton";
const meta = {
  title: "Media/QueueClearButton",
  component: QueueClearButton,
  args: { count: 0, busy: false, clearing: false, onClear: () => {} },
} satisfies Meta<typeof QueueClearButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    expect(
      within(canvasElement).getByRole("button", { name: "Vider la liste de lecture" }),
    ).toBeDisabled();
  },
};
export const Pending: Story = { args: { count: 2, clearing: true, busy: true } };
export const ConfirmedStop: Story = {
  render: () => {
    const [count, setCount] = createSignal(2),
      [clearing, setClearing] = createSignal(false);
    return (
      <div>
        <QueueClearButton
          count={count()}
          busy={false}
          clearing={clearing()}
          onClear={() => setClearing(true)}
        />
        <output aria-label="Queue count">{count()}</output>
        <button
          onClick={() => {
            setCount(0);
            setClearing(false);
          }}
        >
          Confirm native stop
        </button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      clear = canvas.getByRole("button", { name: "Vider la liste de lecture" });
    const before = clear.getBoundingClientRect();
    await userEvent.click(clear);
    expect(clear).toBeDisabled();
    expect(clear).toHaveAttribute("aria-busy", "true");
    expect(canvas.getByLabelText("Queue count")).toHaveTextContent("2");
    expect(clear.getBoundingClientRect().width).toBe(before.width);
    expect(clear.getBoundingClientRect().height).toBe(before.height);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm native stop" }));
    expect(canvas.getByLabelText("Queue count")).toHaveTextContent("0");
    expect(clear).toBeDisabled();
  },
};
