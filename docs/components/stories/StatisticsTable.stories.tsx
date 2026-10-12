import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { StatisticsTable } from "../../../src/components/StatisticsTable";
import { statisticsFixture } from "../fixtures/statistics";
import { t } from "../../../src/i18n";
const meta = {
  title: "Data/StatisticsTable",
  component: StatisticsTable,
  args: {
    title: "Fictional artists",
    unit: "Tracks",
    first: statisticsFixture(),
    read: async (offset: number) => statisticsFixture(offset),
    rows: (report) => ({
      ...report.top.artists,
      items: report.top.artists.items.map((row) => ({ label: row.name, count: row.tracks })),
    }),
  },
  parameters: {
    docs: {
      description: {
        component: "Real asynchronous pagination using only in-memory fictional pages.",
      },
    },
  },
} satisfies Meta<typeof StatisticsTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FirstPage: Story = {};
export const Pagination: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("Example artist 1", { exact: true })).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole("button", { name: t("Suivant") }));
    await waitFor(() =>
      expect(canvas.getByText("Example artist 51", { exact: true })).toBeVisible(),
    );
    await expect(canvas.getByRole("button", { name: t("Suivant") })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: t("Précédent") }));
    await waitFor(() =>
      expect(canvas.getByText("Example artist 1", { exact: true })).toBeVisible(),
    );
  },
};
