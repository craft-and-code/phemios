import type { Meta, StoryObj } from "storybook-solidjs-vite";
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
