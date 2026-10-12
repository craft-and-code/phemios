import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IntegrityStatus } from "../../../src/components/IntegrityStatus";
const meta = {
  title: "Data/IntegrityStatus",
  component: IntegrityStatus,
  args: {
    value: { ok: 12, ko: 1, no_hash: 2, unchecked: 3, unsupported: 4, stale: 1, md5: 16, crc: 3 },
  },

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof IntegrityStatus>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Unknown: Story = { args: { value: undefined } };
