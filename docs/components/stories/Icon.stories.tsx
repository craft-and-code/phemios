import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Icon } from "../../../src/components/Icon";
const meta = {
  title: "Foundation/Icon",
  component: Icon,
  args: { name: "cover-size" },

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Lyrics: Story = { args: { name: "lyrics" } };
export const Playlist: Story = { args: { name: "playlist" } };
