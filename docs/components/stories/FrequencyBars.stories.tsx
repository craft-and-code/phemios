import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { expect, userEvent, within } from "storybook/test";
import { FrequencyBars } from "../../../src/components/FrequencyBars";
const meta = {
  title: "Media/FrequencyBars",
  component: FrequencyBars,
  args: {
    levels: Array.from({ length: 24 }, (_, i) => 0.12 + (i % 7) / 9),
    frequencies: Array.from({ length: 24 }, (_, i) => 31.5 * 2 ** (i / 2.4)),
    rate: 44100,
    style: "gradient",
    position: 10,
    reference: "fixture:track",
    playing: true,
  },
  render: (args) => (
    <div class="component-scene">
      <FrequencyBars {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Real 24-band presentation. The levels are deterministic fictional values, not captured audio.",
      },
    },
  },
} satisfies Meta<typeof FrequencyBars>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Terminal: Story = { args: { style: "terminal" } };
export const Paused: Story = { args: { playing: false, style: "terminal" } };

export const QuietBands: Story = {
  args: { style: "terminal" },
  render: (args) => {
    const [level, setLevel] = createSignal(0.01),
      [position, setPosition] = createSignal(0);
    return (
      <>
        <div class="component-scene">
          <FrequencyBars {...args} levels={Array(24).fill(level())} position={position()} />
        </div>
        <button
          onClick={() => {
            setLevel(0.7);
            setPosition(100);
          }}
        >
          Signal
        </button>
        <button
          onClick={() => {
            setLevel(0);
            setPosition(200);
          }}
        >
          Silence
        </button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(canvasElement.querySelectorAll(".terminal-band i.lit")).toHaveLength(0);
    expect(canvasElement.querySelectorAll(".terminal-band i.peak")).toHaveLength(0);
    await userEvent.click(c.getByRole("button", { name: "Signal" }));
    expect(canvasElement.querySelectorAll(".terminal-band i.lit").length).toBeGreaterThan(0);
    expect(canvasElement.querySelectorAll(".terminal-band i.peak").length).toBeGreaterThan(0);
    await userEvent.click(c.getByRole("button", { name: "Silence" }));
    expect(canvasElement.querySelectorAll(".terminal-band i.lit")).toHaveLength(0);
    expect(canvasElement.querySelectorAll(".terminal-band i.peak")).toHaveLength(0);
  },
};
