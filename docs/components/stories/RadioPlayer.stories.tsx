import { PlayerTransport } from "../../../src/components/PlayerTransport";
import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { RadioPlayerBarView } from "../../../src/components/RadioPlayerBarView";
import { Icon } from "../../../src/components/Icon";
const meta = {
  title: "Media/RadioPlayer",
  component: RadioPlayerBarView,
  args: {
    station: { name: "Example FM", country: "Fictional country" },
    status: "playing",
    error: "",
    volume: 0.5,
    onPause: () => {},
    onResume: () => {},
    onStop: () => {},
    onMute: () => {},
    onVolume: () => {},
  },
  argTypes: {
    status: { control: "select", options: ["idle", "connecting", "playing", "paused", "error"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The actual radio footer presentation. All actions here are in-memory: no station resolves and no audio plays.",
      },
    },
  },
} satisfies Meta<typeof RadioPlayerBarView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playing: Story = {};
export const Connecting: Story = { args: { status: "connecting" } };
export const Failed: Story = {
  args: { status: "error", error: "A fictional stream cannot be read. Try a different station." },
};
export const StableGeometry: Story = {
  render: (args) => {
    const [status, change] = createSignal(args.status),
      [volume, setVolume] = createSignal(args.volume);
    return (
      <>
        <div class="component-controls">
          <button onClick={() => change("connecting")}>Connecting</button>
          <button onClick={() => change("playing")}>Playing</button>
          <button onClick={() => change("error")}>Error</button>
        </div>
        <RadioPlayerBarView
          {...args}
          status={status()}
          volume={volume()}
          error={
            status() === "error"
              ? "A fictional error long enough to wrap across several lines without moving the controls."
              : ""
          }
          onPause={() => change("paused")}
          onResume={() => change("playing")}
          onMute={() => setVolume((v) => (v ? 0 : 0.5))}
          onVolume={setVolume}
        />
        <footer class="player-bar" aria-label="Reference transport geometry">
          <div class="now-playing">
            <span>Fictional finite-track reference</span>
          </div>
          <PlayerTransport
            controls={
              <div class="play-control">
                <button class="play-button" aria-label="Reference Play">
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
          <div class="player-options">
            <button class="speaker-button" aria-label="Reference Volume">
              <Icon name="volume" />
            </button>
          </div>
        </footer>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radio = canvasElement.querySelector<HTMLElement>(".radio-player")!;
    const reference = canvasElement.querySelector<HTMLElement>("footer:not(.radio-player)")!;
    const geometry = (element: HTMLElement) => {
      const footer = element.getBoundingClientRect();
      return [".play-button", ".speaker-button"].map((selector) => {
        const rect = element.querySelector(selector)!.getBoundingClientRect();
        return rect.top + rect.height / 2 - footer.top;
      });
    };
    const baseline = geometry(reference);
    for (const name of ["Connecting", "Playing", "Error"]) {
      await userEvent.click(canvas.getByRole("button", { name }));
      const actual = geometry(radio);
      if (name === "Error") {
        const message = radio.querySelector<HTMLElement>(".radio-playback-feedback > span")!;
        expect(message.clientWidth).toBeGreaterThan(100);
        expect(message.clientHeight).toBeGreaterThan(20);
        expect(getComputedStyle(message).textOverflow).not.toBe("ellipsis");
        expect(message.scrollWidth).toBeLessThanOrEqual(message.clientWidth + 1);
        expect(message.scrollHeight).toBeLessThanOrEqual(message.clientHeight + 1);
      }
      actual.forEach((center, index) =>
        expect(Math.abs(center - baseline[index]!)).toBeLessThan(0.6),
      );
    }
  },
};
