import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { TransferSelection } from "../../../src/components/TransferSelection";
import { TransferPanel } from "../../../src/components/TransferPanel";
import { PlayersContent } from "../../../src/components/PlayersContent";
import type { TransferOptions, TransferPreview } from "../../../src/library/transfers";
import { t } from "../../../src/i18n";
const meta = {
  title: "Media/ExternalTransfer",
  component: TransferPanel,
  args: {
    rows: [
      {
        reference: "track:fictional",
        title: "Northern Lights",
        artist: "Example Artist",
        album: null,
        number: 1,
        albumTotal: 1,
      },
    ],
    destination: "mount:1",
    ipod: false,
    options: { format: "original", verify: true, replace: false },
    preview: undefined,
    status: { phase: "idle", running: false },
    preparing: false,
    error: "",
    onOptions: () => {},
    onPreview: () => {},
    onStart: () => {},
    onCancel: () => {},
  },
  render: (args) => {
    const [options, setOptions] = createSignal<TransferOptions>(args.options),
      [preview, setPreview] = createSignal<TransferPreview | undefined>(args.preview),
      [destination, setDestination] = createSignal(args.destination);
    return (
      <main style={{ "max-width": "1000px", height: "560px" }}>
        <section class="page result-page players-page">
          <div class="transfer-workspace">
            <TransferSelection
              rows={args.rows}
              disabled={args.preparing || args.status.running}

              onRemove={() => {}}
            />
          </div>
          <section class="transfer-panel transfer-destination">
            <h3>{t("Périphérique de destination")}</h3>
            <PlayersContent
              busy={false}
              volumes={[
                {
                  id: "mount:1",
                  adapter: "mounted",
                  available: true,
                  name: "Example player",
                  path: "/Volumes/Example",
                  format: "exFAT",
                  kind: "removable",
                },
              ]}
              selected={destination()}
              onSelect={setDestination}
            />
          </section>
          <TransferPanel
            {...args}
            destination={destination()}
            options={options()}
            preview={preview()}
            onOptions={(v) => {
              setOptions(v);
              setPreview(undefined);
            }}
            onPreview={() =>
              setPreview({
                id: "preview",
                destination: "mount:1",
                tracks: 1,
                bytes: 24500000,
                ipod: false,
                files: [
                  options().format === "mp3"
                    ? "Example Artist/First Album/01 Northern Lights.mp3"
                    : "Example Artist/First Album/01 Northern Lights.flac",
                ],
              })
            }
          />
        </section>
      </main>
    );
  },
} satisfies Meta<typeof TransferPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Review: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(
      c.getByRole("heading", { name: t("Musique à transférer") }).getBoundingClientRect().top,
    ).toBeLessThan(
      c.getByRole("heading", { name: t("Périphérique de destination") }).getBoundingClientRect()
        .top,
    );
    expect(
      c.getByRole("heading", { name: t("Périphérique de destination") }).getBoundingClientRect()
        .top,
    ).toBeLessThan(
      c.getByRole("heading", { name: t("Options de transfert") }).getBoundingClientRect().top,
    );
    expect(c.getByRole("button", { name: t("Démarrer le transfert") })).toBeDisabled();
    await userEvent.click(c.getByRole("button", { name: t("Préparer l’aperçu") }));
    expect(c.getByRole("button", { name: t("Démarrer le transfert") })).toBeEnabled();
    expect(c.getByText("Example Artist/First Album/01 Northern Lights.flac")).toBeVisible();
    const scroller = canvasElement.querySelector("main")!;
    const last = canvasElement.querySelector(".players-page > .transfer-panel:last-child")!;
    const endGap =
      scroller.scrollHeight -
      (last.getBoundingClientRect().bottom -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop);
    expect(endGap).toBeGreaterThanOrEqual(24);
  },
};
export const Copying: Story = {
  args: {
    status: {
      phase: "copying",
      running: true,
      done: 1,
      total: 3,
      current: "Example Artist/First Album/02.flac",
    },
  },
};
export const AppleIpod: Story = {
  args: { ipod: true, options: { format: "original", verify: false, replace: false } },
};
export const Failure: Story = {
  args: {
    status: {
      phase: "failed",
      running: false,
      done: 1,
      total: 3,
      error: "Le lecteur a été débranché ou démonté.",
    },
  },
};

export const ChooseMusicFirst: Story = {
  args: { destination: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("button", { name: t("Ajouter à la sélection") })).toBeNull();
    expect(canvas.getByRole("button", { name: t("Préparer l’aperçu") })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: t("Sélectionner") }));
    expect(canvas.getByRole("button", { name: t("Préparer l’aperçu") })).toBeEnabled();
  },
};

export const Mp3Output: Story = {
  args: { options: { format: "mp3", verify: true, replace: false } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: t("Préparer l’aperçu") }));
    expect(c.getByText("Example Artist/First Album/01 Northern Lights.mp3")).toBeVisible();
    expect(c.queryByText("Example Artist/First Album/01 Northern Lights.flac")).toBeNull();
    expect(
      c.getByText(
        t("Le volume indiqué est celui des sources ; la taille finale dépend de la conversion."),
      ),
    ).toBeVisible();
  },
};
