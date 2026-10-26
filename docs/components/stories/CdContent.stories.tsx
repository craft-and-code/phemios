import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal, type ComponentProps } from "solid-js";
import { createCdIdentification } from "../../../src/cd/identification";
import { CdHeader } from "../../../src/components/CdHeader";
import { cdPlaybackAction, cdPlaying } from "../../../src/cd/model";
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
/** Same pure header/body composition as the native page, without drive or audio IO. */
function CdScenario(props: ComponentProps<typeof CdContent>) {
  const selected = () => props.drives.find((item) => item.id === props.selected);
  return (
    <section class="page result-page cd-page" style={{ "min-height": "640px" }}>
      <CdHeader
        drive={selected()}
        native={props.native}
        opening={false}
        ejecting={props.ejecting}
        pending={props.busy}
        loading={props.busy}
        reading={["playing", "paused", "connecting"].includes(props.playbackStatus ?? "idle")}
        discPlaying={cdPlaying(
          selected()?.disc?.token,
          props.playing,
          props.playbackStatus ?? "idle",
        )}
        transportBusy={props.transportBusy}
        onOpen={() => {}}
        onEject={() => {}}
        onRefresh={() => {}}
        onCancel={() => {}}
      />
      <CdContent {...props} />
    </section>
  );
}
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
    playbackStatus: "idle",
    canPlay: true,
    transportBusy: false,
    ejecting: false,
    onSelect: () => {},
    onPlay: () => {},
  },
  render: (args) => <CdScenario {...args} />,
} satisfies Meta<typeof CdContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AudioDisc: Story = {
  play: ({ canvasElement }) => {
    const header = canvasElement.querySelector(".page-sticky-header .cd-header-actions");
    expect(header).not.toBeNull();
    const rows = canvasElement.querySelectorAll(".cd-tracks > li");
    expect(getComputedStyle(rows[0]!).borderBottomStyle).toBe("solid");
    expect(getComputedStyle(rows[rows.length - 1]!).borderBottomStyle).toBe("none");
    const buttons = within(header as HTMLElement).getAllByRole("button");
    expect(
      buttons.map((button) => button.getAttribute("aria-label") || button.textContent?.trim()),
    ).toEqual([t("Ouvrir une image CUE"), t("Éjecter le CD"), t("Actualiser")]);
  },
};
export const NoDrive: Story = {
  args: { drives: [] },
  play: ({ canvasElement }) => {
    expect(within(canvasElement).getByRole("button", { name: t("Éjecter le CD") })).toBeDisabled();
  },
};
export const Detecting: Story = { args: { busy: true } };
export const BrowserPreview: Story = { args: { drives: [], native: false } };
export const TrackSelection: Story = {
  render: (args) => {
    const [playing, setPlaying] = createSignal("");
    const [status, setStatus] = createSignal("idle");
    return (
      <CdScenario
        {...args}
        playing={playing()}
        playbackStatus={status()}
        onPlay={(index) => {
          const target = disc.tracks[index ?? 0]!.reference;
          const action = cdPlaybackAction(
            disc.token,
            playing(),
            status(),
            index === undefined ? undefined : target,
          );
          if (action === "pause") setStatus("paused");
          else {
            if (action === "play") setPlaying(target);
            setStatus("playing");
          }
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actions = canvasElement.querySelector(".cd-actions")!;
    expect(actions.querySelector("button:last-child")).toHaveAttribute("data-play-reference");
    expect(canvasElement.querySelector(".cd-disc-art svg")).toBeNull();
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeEnabled();
    const playControls = canvasElement.querySelectorAll<HTMLButtonElement>(
      ".cd-actions .play-action, .cd-tracks .play-action",
    );
    expect(playControls).toHaveLength(disc.tracks.length + 1);
    for (const button of playControls) {
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
    expect(canvas.getByRole("button", { name: t("Mettre le CD en pause") })).toBeEnabled();
    expect(
      canvas.getByRole("button", { name: t("Mettre la piste {0} en pause", 2) }),
    ).toBeEnabled();
    expect(canvasElement.querySelector(".cd-tracks > li.current")?.textContent).toContain(
      t("Piste {0}", 2),
    );
    await userEvent.click(canvas.getByRole("button", { name: t("Mettre le CD en pause") }));
    expect(canvas.getByRole("button", { name: t("Reprendre le CD") })).toBeEnabled();
    expect(canvas.getByRole("button", { name: t("Reprendre la piste {0}", 2) })).toBeEnabled();
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: t("Reprendre la piste {0}", 2) }));
    expect(canvas.getByRole("button", { name: t("Mettre le CD en pause") })).toBeEnabled();
    expect(canvasElement.querySelector(".cd-tracks > li.current")?.textContent).toContain(
      t("Piste {0}", 2),
    );
    await userEvent.click(canvas.getByRole("button", { name: t("Lire la piste {0}", 3) }));
    expect(
      canvas.getByRole("button", { name: t("Mettre la piste {0} en pause", 3) }),
    ).toBeEnabled();
    expect(canvas.getByRole("button", { name: t("Lire la piste {0}", 2) })).toBeEnabled();
  },
};

export const EmptyDrive: Story = {
  args: { drives: [{ ...drive, disc: null }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeEnabled();
    expect(canvas.getByRole("button", { name: t("Actualiser") })).toBeEnabled();
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

export const AnotherDiscIsPlaying: Story = {
  args: { playing: "track:cd/0000000000000009/1", playbackStatus: "playing" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Lire le CD") })).toBeEnabled();
    expect(canvas.queryByRole("button", { name: t("Mettre le CD en pause") })).toBeNull();
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeEnabled();
  },
};
export const BufferingDisc: Story = {
  args: { playing: disc.tracks[1]!.reference, playbackStatus: "connecting" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Mettre le CD en pause") })).toBeEnabled();
    expect(canvas.getByRole("button", { name: t("Éjecter le CD") })).toBeDisabled();
  },
};

/** Runs the actual optional-name admission model, with a synthetic response and no network/drive. */
export const AutomaticTrackNames: Story = {
  render: (args) => {
    const identification = createCdIdentification(
      () => [drive],
      async (token) => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return {
          token,
          metadata: {
            status: "matched",
            title: "Night Signals",
            artist: "Synthetic Ensemble",
            tracks: ["Opening", "Interlude", "Finale"].map((title) => ({
              title,
              artist: "Synthetic Ensemble",
            })),
          },
        };
      },
    );
    return (
      <CdScenario
        {...args}
        drives={identification.drives()}
        identification={identification.message(disc.token)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole("heading", { name: "Night Signals" })).resolves.toBeVisible();
    expect(canvas.getByText("Interlude")).toBeVisible();
    expect(canvas.getByRole("status")).toHaveTextContent(t("Titres complétés avec MusicBrainz."));
    expect(canvas.getByRole("button", { name: t("Lire le CD") })).toBeEnabled();
  },
};
