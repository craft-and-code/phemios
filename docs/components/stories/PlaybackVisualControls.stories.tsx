import { createSignal, Show } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { PlaybackVisualControls } from "../../../src/components/PlaybackVisualControls";
import { PlaybackLyrics } from "../../../src/components/PlaybackLyrics";
import { FrequencyBars } from "../../../src/components/FrequencyBars";
import { nextFrequencyMode, playbackWords } from "../../../src/visualizer/layers";
import type { Scene } from "../../../src/visualizer/particles";
import { t } from "../../../src/i18n";
const meta = {
  title: "Media/PlaybackVisualControls",
  component: PlaybackVisualControls,
  args: {
    scene: "sphere",
    lyricsVisible: true,
    synced: true,
    spectrum: false,
    barStyle: "gradient",
    bandsAvailable: true,
    onScene: () => {},
    onLyrics: () => {},
    onBands: () => {},
  },
  render: (args) => {
    const [scene, setScene] = createSignal<Scene>(args.scene),
      [floating, setFloating] = createSignal(true),
      [ordinary, setOrdinary] = createSignal(args.lyricsVisible),
      [bands, setBands] = createSignal<{ visible: boolean; style: "gradient" | "terminal" }>({
        visible: false,
        style: "gradient",
      });
    return (
      <div class="component-scene">
        <PlaybackVisualControls
          scene={scene()}
          lyricsVisible={playbackWords(scene(), ordinary(), floating())}
          synced={args.synced}
          spectrum={bands().visible}
          barStyle={bands().style}
          bandsAvailable={args.bandsAvailable}
          onScene={setScene}
          onLyrics={() =>
            scene() === "floating" ? setFloating(!floating()) : setOrdinary(!ordinary())
          }
          onBands={() => setBands(nextFrequencyMode(bands().visible, bands().style))}
        />
        <PlaybackLyrics
          text="Le souffle de la nuit"
          cue="fixture:1"
          floating={scene() === "floating"}
          hidden={!playbackWords(scene(), ordinary(), floating())}
          typography={{ track: "fixture:controls", phase: 0 }}
        />
        <Show when={bands().visible}>
          <FrequencyBars
            levels={Array.from({ length: 24 }, (_, i) => 0.1 + (i % 5) / 6)}
            frequencies={Array.from({ length: 24 }, (_, i) => 31.5 * 2 ** (i / 2.4))}
            rate={44100}
            style={bands().style}
            playing={true}
            reference="fixture"
            position={100}
          />
        </Show>
      </div>
    );
  },
} satisfies Meta<typeof PlaybackVisualControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Cycle: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByRole("button")).toHaveLength(6);
    await userEvent.click(c.getByRole("button", { name: t("Afficher les fréquences") }));
    expect(canvasElement.querySelectorAll(".frequency-bar")).toHaveLength(24);
    const labelColor = getComputedStyle(
      canvasElement.querySelector(".frequency-backdrop small")!,
    ).color;
    await userEvent.click(c.getByRole("button", { name: t("Barres du terminal Aède") }));
    expect(canvasElement.querySelectorAll(".terminal-band")).toHaveLength(24);
    expect(
      getComputedStyle(canvasElement.querySelector(".terminal-band i.lit")!).backgroundColor,
    ).toBe(labelColor);
    await userEvent.click(c.getByRole("button", { name: t("Masquer les fréquences") }));
    expect(canvasElement.querySelector(".frequency-backdrop")).toBeNull();
    await userEvent.click(c.getByRole("button", { name: t("Afficher ou masquer les paroles") }));
    await userEvent.click(c.getByRole("button", { name: t("Paroles flottantes") }));
    const lyrics = c.getByRole("button", { name: t("Afficher ou masquer les paroles") });
    expect(lyrics).toBeEnabled();
    expect(lyrics).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(lyrics);
    expect(lyrics).toHaveAttribute("aria-pressed", "false");
    expect(canvasElement.querySelector(".playback-current-lyrics")).toHaveAttribute("hidden");
    await userEvent.click(lyrics);
    expect(canvasElement.querySelector(".playback-current-lyrics")).not.toHaveAttribute("hidden");
    await userEvent.click(c.getByRole("button", { name: t("Paroles flottantes") }));
    expect(lyrics).toBeEnabled();
    expect(lyrics).toHaveAttribute("aria-pressed", "false");
  },
};
