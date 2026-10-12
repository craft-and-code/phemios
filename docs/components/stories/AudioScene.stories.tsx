import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { AudioScene } from "../../../src/components/AudioScene";
const meta = {
  title: "Media/AudioScene",
  component: AudioScene,
  args: { scene: "sphere", playing: false, levels: [0.3, 0.7, 0.2, 0.6] },
  render: (args) => (
    <div class="component-scene">
      <AudioScene {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Real resident 3D renderer with fictional levels. Pointer orbit is available; no PCM transport is created.",
      },
    },
  },
} satisfies Meta<typeof AudioScene>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Waves: Story = { args: { scene: "waves", playing: true } };
export const Landscape: Story = { args: { scene: "landscape", playing: true } };
export const Floating: Story = { args: { scene: "floating", playing: true } };
