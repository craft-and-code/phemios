import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ProductVersions } from "../../../src/components/ProductVersions";
const meta = {
  title: "Settings/ProductVersions",
  component: ProductVersions,
  args: {
    rows: [
      { name: "Phémios", version: "0.1.0", url: "https://craft-and-code.github.io/phemios/" },
      { name: "Aède · Local", version: "0.4.0", url: "https://craft-and-code.github.io/aede/" },
      {
        name: "FlacCompagnon Core · Local",
        version: "0.9.5",
        url: "https://craft-and-code.github.io/FlacCompagnon/",
      },
    ],
    onOpen: () => {},
  },
} satisfies Meta<typeof ProductVersions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
