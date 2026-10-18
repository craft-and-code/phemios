import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
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
    onChoose: () => {},
    onRemove: () => {},
    onPreview: () => {},
    onStart: () => {},
    onCancel: () => {},
  },
  render: (args) => {
    const [options, setOptions] = createSignal<TransferOptions>(args.options),
      [preview, setPreview] = createSignal<TransferPreview | undefined>(args.preview);
    return (
      <section
        class="page result-page players-page"
        style={{ "max-width": "1000px", height: "calc(100vh - 100px)", overflow: "auto" }}
      >
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
          selected="mount:1"
          onSelect={() => {}}
        />
        <TransferPanel
          {...args}
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
              files: ["Example Artist/First Album/01 Northern Lights.flac"],
            })
          }
        />
      </section>
    );
  },
} satisfies Meta<typeof TransferPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Review: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole("button", { name: t("Démarrer le transfert") })).toBeDisabled();
    await userEvent.click(c.getByRole("button", { name: t("Préparer l’aperçu") }));
    expect(c.getByRole("button", { name: t("Démarrer le transfert") })).toBeEnabled();
    expect(c.getByText("Example Artist/First Album/01 Northern Lights.flac")).toBeVisible();
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
