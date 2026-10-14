import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { PlayersContent } from "../../../src/components/PlayersContent";
import { RefreshButton } from "../../../src/components/RefreshButton";
import { StickyHeader } from "../../../src/components/StickyHeader";
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
      <PlayersContent {...args} />
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
              busyIndicator="stop"
              onRefresh={() => setBusy(true)}
              onCancel={() => setBusy(false)}
            />
          </div>
        </StickyHeader>
        <PlayersContent {...args} busy={busy()} selected={selected()} onSelect={setSelected} />
      </section>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t("Sélectionner") }));
    await userEvent.click(canvas.getByRole("button", { name: t("Actualiser") }));
    expect(canvasElement.querySelectorAll(".spinner").length).toBe(1);
    expect(canvasElement.querySelectorAll(".page-loader-inline").length).toBe(0);
    expect(canvas.queryByText(volume.name)).toBeNull();
    const page = canvasElement.querySelector(".players-page")!.getBoundingClientRect(),
      spinner = canvasElement.querySelector(".spinner")!.getBoundingClientRect();
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
