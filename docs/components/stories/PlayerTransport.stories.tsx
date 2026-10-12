import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PlayerTransport } from "../../../src/components/PlayerTransport";
import { Icon } from "../../../src/components/Icon";
const meta = {
  title: "Media/PlayerTransport",
  component: PlayerTransport,
  args: { controls: undefined, timeline: undefined },
  render: () => (
    <footer class="player-bar">
      <div />
      <PlayerTransport
        controls={
          <div class="play-control">
            <button class="play-button" aria-label="Fictional Play">
              <Icon name="play" />
            </button>
          </div>
        }
        timeline={
          <div class="playback-progress">
            <small>0:00</small>
            <div class="waveform-seek" />
            <small>2:00</small>
          </div>
        }
      />
      <div />
    </footer>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Actual shared footer slots. Controls are 38 px high and the waveform/live row is 28 px, keeping the axes fixed for all transports.",
      },
    },
  },
} satisfies Meta<typeof PlayerTransport>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Finite: Story = {};
