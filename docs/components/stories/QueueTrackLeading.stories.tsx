import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSignal } from "solid-js";
import { QueueTrackLeading } from "../../../src/components/QueueTrackLeading";
const meta = {
  title: "Media/QueueTrackLeading",
  component: QueueTrackLeading,
  args: {
    number: 4,
    albumTotal: 12,
    available: false,
    busy: false,
    disabled: false,
    onAction: () => {},
  },
  render: (args) => {
    const [stopped, setStopped] = createSignal(false);
    return (
      <section class="playback-page">
        <aside class="playback-queue">
          <ol>
            <li>
              <span />
              <QueueTrackLeading
                {...args}
                busy={args.busy && !stopped()}
                onAction={() => setStopped(true)}
              />
              <button class="queue-track">
                <span class="queue-track-description">
                  <strong>Fictional track title</strong>
                  <small>Example Artist · Example Album</small>
                </span>
              </button>
            </li>
          </ol>
        </aside>
      </section>
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Actual queue number and lyric action; cancelling is a local fictional state change, with no native task or account.",
      },
    },
  },
} satisfies Meta<typeof QueueTrackLeading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Missing: Story = {};
export const Available: Story = { args: { available: true } };
export const Downloading: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-label="Arrêter le téléchargement des paroles"]',
    );
    if (!button || button.disabled) throw Error("Track Stop is unavailable");
    button.focus();
    if (getComputedStyle(button.querySelector(".activity-stop")!).opacity !== "1")
      throw Error("Stop is not visible on focus");
    button.click();
    if (canvasElement.querySelector(".activity-glyph"))
      throw Error("Stopped action retained its loader");
  },
};

export const Timed: Story = {
  args: { available: true, synced: true },
  play: async ({ canvasElement }) => {
    const marker = canvasElement.querySelector('[aria-label="Paroles synchronisées"]');
    if (!marker || !marker.querySelector("svg path")?.getAttribute("d")?.includes("M17 11v4"))
      throw new Error("Timed lyric clock is absent");
  },
};
export const Plain: Story = {
  args: { available: true, synced: false },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[aria-label="Paroles non synchronisées"]'))
      throw new Error("Plain lyrics are not distinguished");
  },
};
