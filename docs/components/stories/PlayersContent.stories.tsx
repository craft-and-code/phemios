import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { PlayersContent } from "../../../src/components/PlayersContent";
import { RefreshButton } from "../../../src/components/RefreshButton";
import { StickyHeader } from "../../../src/components/StickyHeader";
import { TransferSelection } from "../../../src/components/TransferSelection";
import { t } from "../../../src/i18n";
const volume = {
  name: "Example player",
  path: "/Volumes/Example",
  format: "exFAT",
  kind: "removable" as const,
};
const meta = {
  title: "Data/PlayersContent",
  component: PlayersContent,
  args: { busy: false, volumes: [volume], selected: "", onSelect: () => {} },
  render: (args) => (
    <section class="page result-page players-page" style={{ height: "480px" }}>
      <section class="transfer-panel transfer-destination">
        <h3>{t("Périphérique de destination")}</h3>
        <PlayersContent {...args} />
      </section>
    </section>
  ),
} satisfies Meta<typeof PlayersContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { volumes: [] } };
export const Refresh: Story = {
  render: (args) => {
    const [busy, setBusy] = createSignal(false),
      [selected, setSelected] = createSignal("");
    return (
      <section class="page result-page players-page" style={{ height: "480px" }}>
        <StickyHeader>
          <div class="page-heading">
            <span>Mounted volumes</span>
            <RefreshButton
              busy={busy()}
              onRefresh={() => setBusy(true)}
              onCancel={() => setBusy(false)}
            />
          </div>
        </StickyHeader>
        <div class="transfer-workspace">
          <TransferSelection rows={[]} disabled={false} onRemove={() => {}} />
        </div>
        <section class="transfer-panel transfer-destination">
          <h3>{t("Périphérique de destination")}</h3>
          <PlayersContent {...args} busy={busy()} selected={selected()} onSelect={setSelected} />
        </section>
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t("Sélectionner") }));
    await userEvent.click(canvas.getByRole("button", { name: t("Actualiser") }));
    expect(canvasElement.querySelectorAll(".spinner").length).toBe(2);
    expect(canvasElement.querySelectorAll(".page-loader-inline").length).toBe(0);
    expect(canvas.queryByText(volume.name)).toBeNull();
    const page = canvasElement.querySelector(".transfer-destination")!.getBoundingClientRect(),
      spinner = canvasElement.querySelector(".page-loader .spinner")!.getBoundingClientRect();
    expect(Math.abs(spinner.left + spinner.width / 2 - page.left - page.width / 2)).toBeLessThan(1);
    expect(Math.abs(spinner.top + spinner.height / 2 - page.top - page.height / 2)).toBeLessThan(1);
    await userEvent.click(canvas.getByRole("button", { name: t("Arrêter") }));
    await waitFor(() => expect(canvas.getByText(volume.name)).toBeVisible());
    expect(canvasElement.querySelectorAll(".spinner").length).toBe(0);
    expect(canvas.getByRole("button", { name: t("Sélectionner") })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

export const UnsupportedIpod: Story = {
  args: {
    volumes: [
      {
        ...volume,
        id: "mount:8",
        adapter: "ipod",
        available: false,
        model: "iPod nano 7G",
        icon: "ipod-touch",
        ipodSupported: false,
        ejectable: true,
        unavailableReason: "Ce modèle d’iPod n’est pas pris en charge par podkit.",
      },
    ],
    onEject: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("iPod nano 7G")).toBeVisible();
    expect(canvas.getByRole("button", { name: t("Sélectionner") })).toBeDisabled();
    expect(canvas.getByRole("button", { name: t("Éjecter {0}", volume.name) })).toBeEnabled();
  },
};
export const TransferOwnsDevice: Story = {
  args: { ...UnsupportedIpod.args, disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: t("Éjecter {0}", volume.name) })).toBeDisabled();
  },
};

export const DestinationGeometry: Story = {
  args: { volumes: [{ ...volume, id: "mount:1", ejectable: true }], onEject: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("button", { name: t("Sélectionner") });
    const eject = canvas.getByRole("button", { name: t("Éjecter {0}", volume.name) });
    expect(
      Math.abs(select.getBoundingClientRect().height - eject.getBoundingClientRect().height),
    ).toBeLessThan(1);
    const row = canvasElement.querySelector(".player-destination-row")!;
    expect(parseFloat(getComputedStyle(row).borderBottomWidth)).toBe(0);
    const page = canvasElement.querySelector(".players-page")!;
    expect(parseFloat(getComputedStyle(page).paddingBottom)).toBeGreaterThanOrEqual(24);
  },
};
export const MultipleDestinations: Story = {
  args: { volumes: [volume, { ...volume, name: "Second player", path: "/Volumes/Second" }] },
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll(".player-destination-row");
    expect(parseFloat(getComputedStyle(rows[0]!).borderBottomWidth)).toBe(1);
    expect(parseFloat(getComputedStyle(rows[1]!).borderBottomWidth)).toBe(0);
  },
};

export const FolderDestination: Story = {
  args: {
    volumes: [
      {
        id: "mount:9",
        adapter: "mounted",
        available: true,
        name: "Exports",
        path: "/Users/example/Exports",
        format: "",
        kind: "folder",
        icon: "folder",
        ejectable: false,
      },
    ],
    selected: "mount:9",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Dossier/)).toBeVisible();
    expect(canvas.queryByRole("button", { name: /Éjecter/ })).toBeNull();
  },
};
