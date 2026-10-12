import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { RoonImportMapping } from "../../../src/components/RoonImportMapping";
import { RoonImportPreview } from "../../../src/components/RoonImportPreview";
import { suggestRoonMapping } from "../../../src/imports/roon-plan";
const headers = ["Artist", "Album", "Year", "Editorial Rating", "My Rating", "Tags", "Note"];
const meta = {
  title: "Data/RoonImport",
  component: RoonImportMapping,
  args: { headers, mapping: suggestRoonMapping(headers), disabled: false, onChange: () => {} },
  parameters: {
    docs: {
      description: {
        component:
          "Actual column mapper and read-only preview. Fictional values; no files, accounts or writes.",
      },
    },
  },
} satisfies Meta<typeof RoonImportMapping>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Columns: Story = {
  render: (args) => {
    const [mapping, change] = createSignal(args.mapping);
    return (
      <>
        <RoonImportMapping {...args} mapping={mapping()} onChange={change} />
        <output class="component-readout">Personal rating column: {mapping().rating}</output>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Personal rating column: -1")).toBeVisible();
    await userEvent.click(canvas.getByRole("combobox", { name: "Étoiles personnelles (1–5)" }));
    await userEvent.click(within(document.body).getByRole("option", { name: /^My Rating$/ }));
    await expect(canvas.getByText("Personal rating column: 4")).toBeVisible();
  },
};
export const Preview: Story = {
  render: () => (
    <RoonImportPreview
      rows={[
        {
          line: 2,
          title: "Aether",
          artist: "Example Artist",
          status: "ready",
          desired: { rating: 4, loved: true, tags: ["music"], note: "Fictional personal note" },
        },
        { line: 3, title: "Boreal", artist: "Example Artist", status: "ambiguous" },
        { line: 4, title: "Cobalt", artist: "Example Artist", status: "conflict" },
        { line: 5, title: "Missing edition", artist: "Example Artist", status: "missing" },
      ]}
    />
  ),
};
export const ReadOnly: Story = { args: { disabled: true } };
