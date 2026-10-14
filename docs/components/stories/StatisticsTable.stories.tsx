import { createSignal } from "solid-js";
import { statisticsSelection } from "../../../src/library/statistics-navigation";
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

export const CatalogLinks: Story = {
  render: (args) => {
    const [selection, setSelection] = createSignal("");
    const rows = (kind: "country" | "decade", labels: string[]) => ({
      items: labels.map((label) => {
        const selected = statisticsSelection(kind, label);
        return {
          label,
          count: 2,
          ...(selected
            ? {
                browse: {
                  href: `#/${selected.section}`,
                  select: () => setSelection(JSON.stringify(selected)),
                },
              }
            : {}),
        };
      }),
      total: labels.length,
      offset: 0,
      limit: 50,
      scanned_at: 1,
    });
    return (
      <>
        <StatisticsTable
          {...args}
          title="Decades"
          rows={() => rows("decade", ["1990", "No year"])}
        />
        <StatisticsTable
          {...args}
          title="Countries"
          rows={() => rows("country", ["United Kingdom"])}
        />
        <output data-testid="selection">{selection()}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const decade = canvas.getByRole("link", { name: "1990" });
    expect(decade).toHaveAttribute("href", "#/albums");
    expect(canvas.queryByRole("link", { name: "No year" })).toBeNull();
    await userEvent.click(decade);
    expect(canvas.getByTestId("selection")).toHaveTextContent('"years":[1990,1999]');
    const country = canvas.getByRole("link", { name: "United Kingdom" });
    expect(country).toHaveAttribute("href", "#/countries");
    await userEvent.click(country);
    expect(canvas.getByTestId("selection")).toHaveTextContent('"countries":["United Kingdom"]');
  },
};
