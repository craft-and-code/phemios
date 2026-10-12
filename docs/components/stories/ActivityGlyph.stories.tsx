import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ActivityGlyph } from "../../../src/components/ActivityGlyph";
const meta = {
  title: "Status/ActivityGlyph",
  component: ActivityGlyph,
  args: { cancellable: false },
  render: (args) => (
    <button class="icon-button" aria-label="Fictional pending action" aria-busy="true">
      <ActivityGlyph {...args} />
    </button>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof ActivityGlyph>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Cancellable: Story = { args: { cancellable: true } };
