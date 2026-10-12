import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { StatValue } from "../../../src/components/StatValue";
const meta = {
  title: "Data/StatValue",
  component: StatValue,
  args: { value: "3 j 21 h 18 min" },
  render: (args) => (
    <div class="component-stat">
      <StatValue {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Actual proportional fit for a 160-pixel statistic cell, including long localized values and unknown data.",
      },
    },
  },
} satisfies Meta<typeof StatValue>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Unknown: Story = { args: { value: undefined } };
