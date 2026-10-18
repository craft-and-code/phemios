import { createSignal } from "solid-js";
import { createUntimedLyrics } from "../../../src/visualizer/untimed-lyrics";
import { UntimedLyricsControls } from "../../../src/components/UntimedLyricsControls";
import { userEvent, within } from "storybook/test";
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

export const ManualNavigation: Story = {
  render: () => {
    const [clock, setClock] = createSignal({ reference: "track:fixture", position: 0 });
    const words = {
      source: "tag",
      synced: false,
      lines: ["First fixture line", "Second fixture line", "Third fixture line"].map((text) => ({
        text,
        at_ms: null,
      })),
    };
    const cursor = createUntimedLyrics(
      () => clock().reference,
      () => words,
    );
    return (
      <>
        <div class="component-scene playback-lyric-stage playback-visuals">
          <PlaybackLyrics
            text={cursor.lines()[cursor.index()] ?? ""}
            cue={cursor.index()}
            floating={false}
          />
          <UntimedLyricsControls
            index={cursor.index()}
            total={cursor.lines().length}
            previous={cursor.previous}
            next={cursor.next}
          />
        </div>
        <button onClick={() => setClock((value) => ({ ...value, position: value.position + 250 }))}>
          Poll clock
        </button>
        <button onClick={() => setClock({ reference: "track:other", position: 0 })}>
          Change track
        </button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Phrase suivante" }));
    await waitFor(() => expect(canvas.getByText("Second fixture line")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Poll clock" }));
    expect(canvas.getByText("Second fixture line")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Phrase précédente" }));
    await waitFor(() => expect(canvas.getByText("First fixture line")).toBeVisible());
    expect(canvas.getByRole("button", { name: "Phrase précédente" })).toBeDisabled();
  },
};
