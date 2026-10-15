import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PlayerTransport } from "../../../src/components/PlayerTransport";
import { expect, within, userEvent } from "storybook/test";
import { createSignal } from "solid-js";
import { CircularPlaybackActionsView } from "../../../src/components/CircularPlaybackActionsView";
import { QueueAppendView } from "../../../src/components/QueueAppendView";
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
export const StopBadge: Story = {
  render: () => {
    const [stops, setStops] = createSignal(0),
      [plays, setPlays] = createSignal(0),
      [disabled, setDisabled] = createSignal(false);
    return (
      <>
        <div style={{ padding: "20px" }}>
          <CircularPlaybackActionsView
            play={
              <button class="detail-play" aria-label="Reference Play">
                <Icon name="play" />
              </button>
            }
            append={
              <QueueAppendView
                reference="release:example"
                title="Reference"
                onAppend={async () => 1}
              />
            }
          />
        </div>
        <footer class="player-bar">
          <div />
          <PlayerTransport
            timeline={<div />}
            controls={
              <div class="play-control">
                <button
                  class="play-button"
                  aria-label="Fictional Play"
                  onClick={() => setPlays(plays() + 1)}
                >
                  <Icon name="play" />
                </button>
                <button
                  class="icon-button transport-stop"
                  disabled={disabled()}
                  aria-label="Fictional Stop"
                  onClick={() => setStops(stops() + 1)}
                >
                  <Icon name="stop" />
                </button>
              </div>
            }
          />
          <div />
        </footer>
        <button onClick={() => setDisabled(true)}>Disable Stop</button>
        <output aria-label="Stops">{stops()}</output>
        <output aria-label="Plays">{plays()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      stop = canvas.getByRole("button", { name: "Fictional Stop" }),
      play = canvas.getByRole("button", { name: "Fictional Play" }),
      add = canvas.getByRole("button", { name: "Ajouter Reference à la suite" }),
      a = add.getBoundingClientRect(),
      s = stop.getBoundingClientRect(),
      p = play.getBoundingClientRect();
    expect(s.width).toBe(a.width);
    expect(s.height).toBe(a.height);
    expect(s.bottom - p.bottom).toBe(5);
    expect(s.right - p.right).toBe(7);
    for (const key of ["backgroundColor", "border", "padding", "boxShadow"] as const)
      expect(getComputedStyle(stop)[key]).toBe(getComputedStyle(add)[key]);
    expect(stop.querySelector("svg")!.getBoundingClientRect().width).toBe(
      add.querySelector("svg")!.getBoundingClientRect().width,
    );
    const hit = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    expect(stop.contains(hit)).toBe(true);
    await userEvent.click(stop);
    expect(canvas.getByLabelText("Stops")).toHaveTextContent("1");
    expect(canvas.getByLabelText("Plays")).toHaveTextContent("0");
    await userEvent.unhover(stop);
    await userEvent.click(canvas.getByRole("button", { name: "Disable Stop" }));
    expect(stop).toBeDisabled();
    expect(getComputedStyle(stop).opacity).toBe("1");
    expect(getComputedStyle(stop).backgroundColor).toBe(getComputedStyle(add).backgroundColor);
    expect(getComputedStyle(stop.querySelector("svg")!).opacity).toBe("0.5");
  },
};
