import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ProductVersions } from "../../../src/components/ProductVersions";
const meta = {
  title: "Settings/ProductVersions",
  component: ProductVersions,
  args: {
    rows: [
      { name: "Phémios", version: "0.1.0" },
      { name: "Aède", version: "0.4.0", url: "https://craft-and-code.github.io/aede/" },
      {
        name: "FlacCompagnon Core",
        version: "0.9.5",
        url: "https://craft-and-code.github.io/FlacCompagnon/",
      },
    ],
    onOpen: () => {},
  },
} satisfies Meta<typeof ProductVersions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  decorators: [
    (Story) => (
      <section class="settings-card">
        <Story />
      </section>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("link", { name: "Phémios" })).toBeNull();
    expect(canvas.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "https://craft-and-code.github.io/aede/",
      "https://craft-and-code.github.io/FlacCompagnon/",
    ]);
    const rows = canvasElement.querySelectorAll(".product-version");
    expect(getComputedStyle(rows[rows.length - 1]!).borderBottomWidth).toBe("0px");
  },
};
