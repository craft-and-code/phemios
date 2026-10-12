import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { EmptyState } from "../../../src/components/EmptyState";
const meta = {
  title: "Status/EmptyState",
  component: EmptyState,
  args: { icon: "heart", children: "Aucun album favori dans cette sélection." },
  render: (args) => (
    <div class="component-empty">
      <EmptyState {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Tags: Story = {
  args: { icon: "tags", children: "Aucun élément tagué dans cette sélection." },
};
