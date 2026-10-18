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
    const drift = canvasElement.querySelector(".lyric-drift")!;
    expect(getComputedStyle(drift).animationName).toBe("lyric-drift");
    expect(getComputedStyle(drift).translate).toBe("none");
    const chunks = [...canvasElement.querySelectorAll(".lyric-foreground .lyric-chunk")];
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

export const BassEcho: Story = {
  render: (args) => {
    const [audio, setAudio] = createSignal({
        levels: [0, 0, 0],
        frequencies: [50, 120, 2000],
        position: 0,
        reference: "fixture:bass",
      }),
      [playing, setPlaying] = createSignal(true),
      [hidden, setHidden] = createSignal(false);
    return (
      <>
        <div class="component-scene playback-lyric-stage">
          <PlaybackLyrics {...args} audio={audio()} playing={playing()} hidden={hidden()} />
        </div>
        <button
          onClick={() =>
            setAudio((old) => ({ ...old, levels: [0.6, 0.6, 0], position: old.position + 100 }))
          }
        >
          Bass attack
        </button>
        <button
          onClick={() =>
            setAudio((old) => ({ ...old, levels: [0, 0, 0.9], position: old.position + 400 }))
          }
        >
          Treble only
        </button>
        <button onClick={() => setPlaying(!playing())}>Pause echo</button>
        <button onClick={() => setHidden(!hidden())}>Hide words</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(".lyrics-ready")).not.toBeNull());
    const echo = canvasElement.querySelector(".lyric-bass-echo")!;
    expect(echo).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(c.getByRole("button", { name: "Treble only" }));
    expect(echo.getAnimations()).toHaveLength(0);
    await userEvent.click(c.getByRole("button", { name: "Bass attack" }));
    await waitFor(() => expect(echo.getAnimations()).toHaveLength(1));
    const frames = (echo.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes();
    expect(Number(frames[0]!.opacity)).toBeGreaterThan(0);
    expect(Number(frames[1]!.opacity)).toBe(0);
    expect(frames[1]!.transform).toContain("scale(1.");
    await userEvent.click(c.getByRole("button", { name: "Pause echo" }));
    expect(echo.getAnimations()).toHaveLength(0);
    expect(canvasElement.querySelectorAll(".lyric-bass-echo")).toHaveLength(1);
    await userEvent.click(c.getByRole("button", { name: "Pause echo" }));
    await userEvent.click(c.getByRole("button", { name: "Treble only" }));
    await userEvent.click(c.getByRole("button", { name: "Bass attack" }));
    expect(echo.getAnimations()).toHaveLength(1);
    await userEvent.click(c.getByRole("button", { name: "Hide words" }));
    expect(echo.getAnimations()).toHaveLength(0);
  },
};
