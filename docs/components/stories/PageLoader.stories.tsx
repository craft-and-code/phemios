import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PageLoader } from "../../../src/components/PageLoader";
const meta = {
  title: "Status/PageLoader",
  component: PageLoader,
  args: { label: "Chargement de la bibliothèque…", inline: false },
  render: (args) => (
    <div class="component-empty">
      <PageLoader {...args} />
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
} satisfies Meta<typeof PageLoader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Inline: Story = { args: { inline: true } };
