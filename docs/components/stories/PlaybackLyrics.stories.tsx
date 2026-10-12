import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, waitFor } from "storybook/test";
import { PlaybackLyrics } from "../../../src/components/PlaybackLyrics";
const meta = {
  title: "Media/PlaybackLyrics",
  component: PlaybackLyrics,
  args: {
    text: "A floating signal crosses the night",
    cue: 1,
    floating: true,
    typography: { track: "fictional-track", phase: 0 },
  },
  render: (args) => (
    <div class="component-scene playback-lyric-stage">
      <PlaybackLyrics {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Actual lyric composition and movement with fictional words; no media or native playback.",
      },
    },
  },
} satisfies Meta<typeof PlaybackLyrics>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Floating: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector(".lyrics-ready")).not.toBeNull());
    expect(canvasElement.querySelector(".lyric-shadow")).toBeNull();
    const chunks = [...canvasElement.querySelectorAll(".lyric-chunk")];
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) expect(getComputedStyle(chunk).textShadow).toBe("none");
  },
};
export const Ordinary: Story = { args: { floating: false } };
