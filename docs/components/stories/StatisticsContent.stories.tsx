import { createSignal } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { StatisticsContent } from "../../../src/components/StatisticsContent";
import { RefreshButton } from "../../../src/components/RefreshButton";
import { StatisticsTable } from "../../../src/components/StatisticsTable";
import { statisticsFixture } from "../fixtures/statistics";
const meta = {
  title: "Data/StatisticsContent",
  component: StatisticsContent,
  args: { busy: false, children: <></> },
} satisfies Meta<typeof StatisticsContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Reload: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false);
    return (
      <div style={{ position: "relative", height: "400px" }}>
        <RefreshButton
          busy={busy()}
          busyIndicator="stop"
          onRefresh={() => setBusy(true)}
          onCancel={() => setBusy(false)}
        />
        <StatisticsContent busy={busy()}>
          <StatisticsTable
            title="Fictional formats"
            unit="Files"
            first={statisticsFixture()}
            read={async (offset) => statisticsFixture(offset)}
            rows={(r) => ({
              ...r.top.artists,
              items: r.top.artists.items.map((a) => ({ label: a.name, count: a.tracks })),
            })}
          />
        </StatisticsContent>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("Example artist 1", { exact: true })).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Actualiser" }));
    expect(canvasElement.querySelectorAll(".spinner").length).toBe(1);
    expect(canvasElement.querySelectorAll(".page-loader-inline").length).toBe(0);
    const root = canvasElement.firstElementChild!.getBoundingClientRect(),
      spinner = canvasElement.querySelector(".spinner")!.getBoundingClientRect();
    expect(Math.abs(spinner.left + spinner.width / 2 - root.left - root.width / 2)).toBeLessThan(1);
    expect(Math.abs(spinner.top + spinner.height / 2 - root.top - root.height / 2)).toBeLessThan(1);
    await userEvent.click(canvas.getByRole("button", { name: "Arrêter" }));
    await waitFor(() =>
      expect(canvas.getByText("Example artist 1", { exact: true })).toBeVisible(),
    );
    expect(canvasElement.querySelectorAll(".spinner").length).toBe(0);
  },
};
