import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { RelationGraph } from "../../../src/components/RelationGraph";
const meta = {
  title: "Media/RelationGraph",
  component: RelationGraph,
  args: {
    name: "Example Ensemble",
    edges: [
      {
        reference: "artist:example-a",
        name: "Example collaborator",
        weight: 3,
        source: "Fictional credits",
        kind: "artist",
      },
      {
        reference: "album:example-b",
        name: "Example album",
        weight: 2,
        source: "Fictional credits",
        kind: "album",
      },
    ],
    onSelect: () => {},
  },

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof RelationGraph>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { edges: [] } };
