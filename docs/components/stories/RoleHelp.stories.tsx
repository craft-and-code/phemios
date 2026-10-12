import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { RoleHelp } from "../../../src/components/RoleHelp";
const meta = {
  title: "Controls/RoleHelp",
  component: RoleHelp,
  args: {},

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof RoleHelp>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
