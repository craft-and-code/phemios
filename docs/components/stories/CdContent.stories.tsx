import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { CdContent } from "../../../src/components/CdContent";
import { t } from "../../../src/i18n";
const disc = {
  token: "0000000000000002",
  tracks: [1, 2, 3].map((number) => ({
    reference: `track:cd/0000000000000002/${number}`,
    number,
    duration_ms: number * 60000,
  })),
};
const drive = { id: "0000000000000001", name: "Example CD drive", error: null, disc };
const meta = {
  title: "Sources/CdContent",
  component: CdContent,
  args: {
    drives: [drive],
    selected: drive.id,
    busy: false,
    error: "",
    native: true,
    playing: "",
    canPlay: true,
    transportBusy: false,
    ejecting: false,
    onSelect: () => {},
    onPlay: () => {},
    onEject: () => {},
  },
  render: (args) => (
    <section class="page result-page cd-page" style={{ "min-height": "640px" }}>
      <CdContent {...args} />
    </section>
  ),
} satisfies Meta<typeof CdContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AudioDisc: Story = {};
export const NoDrive: Story = { args: { drives: [] } };
export const Detecting: Story = { args: { busy: true } };
export const BrowserPreview: Story = { args: { drives: [], native: false } };
export const TrackSelection: Story = {
  render: (args) => {
    const [playing, setPlaying] = createSignal("");
    return (
      <section class="page result-page cd-page" style={{ "min-height": "640px" }}>
        <CdContent
          {...args}
          playing={playing()}
          discPlaying={!!playing()}
          onPlay={(index) => setPlaying(disc.tracks[index]!.reference)}
        />
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actions = canvasElement.querySelector(".cd-actions")!;
    expect(actions.querySelector("button:last-child")).toHaveAttribute("data-play-reference");
    expect(canvasElement.querySelector(".cd-disc-art svg")).toBeNull();
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeEnabled();
    for (const button of canvas.getAllByRole("button", { name: /^Lire/ })) {
      const control = button.getBoundingClientRect();
      const triangle = button.querySelector("path")!.getBoundingClientRect();
      expect(
        Math.abs((triangle.left + triangle.right - control.left - control.right) / 2),
      ).toBeLessThan(0.75);
      expect(
        Math.abs((triangle.top + triangle.bottom - control.top - control.bottom) / 2),
      ).toBeLessThan(0.75);
    }
    await userEvent.click(canvas.getByRole("button", { name: t("Lire la piste {0}", 2) }));
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeDisabled();
    expect(canvasElement.querySelector(".cd-tracks > li.current")?.textContent).toContain(
      t("Piste {0}", 2),
    );
  },
};

export const EmptyDrive: Story = {
  args: { drives: [{ ...drive, disc: null }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeDisabled();
    expect(canvas.queryByRole("button", { name: t("Lire le CD") })).toBeNull();
  },
};

export const CueImage: Story = {
  args: {
    drives: [
      {
        ...drive,
        image: true,
        name: "Example.cue",
        disc: {
          ...disc,
          title: "Example suite",
          artist: "Fictional Ensemble",
          tracks: disc.tracks.map((track, index) => ({
            ...track,
            title: ["Overture", "Nocturne", "Finale"][index] ?? null,
          })),
        },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("heading", { name: "Example suite" })).toBeVisible();
    expect(canvas.getByText("Nocturne")).toBeVisible();
    expect(canvas.getByRole("button", { name: t("Fermer l’image CD") })).toBeEnabled();
  },
};
