import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ResultCount } from "../../../src/components/ResultCount";
const meta = {
  title: "Status/ResultCount",
  component: ResultCount,
  args: { value: 1234 },

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof ResultCount>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { value: 0 } };

export const MoodParity: Story = {
  render: () => (
    <>
      <div class="personal-selection-actions">
        <ResultCount value={12} />
      </div>
      <div class="moods-page">
        <div class="page-heading">
          <ResultCount value={12} />
        </div>
      </div>
    </>
  ),
  play: ({ canvasElement }) => {
    const counts = canvasElement.querySelectorAll(".result-count");
    expect(getComputedStyle(counts[1]!).fontSize).toBe(getComputedStyle(counts[0]!).fontSize);
  },
};
