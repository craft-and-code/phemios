import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, within } from "storybook/test";
import { TrackDurationTotal } from "../../../src/components/TrackDurationTotal";
const meta = {
  title: "Media/TrackDurationTotal",
  component: TrackDurationTotal,
  args: {
    tracks: [
      { reference: "track:one", duration_ms: 3_600_000 },
      { reference: "track:two", duration_ms: 125_000 },
    ],
  },
} satisfies Meta<typeof TrackDurationTotal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByLabelText("Durée totale")).toHaveTextContent("1:02:05");
  },
};
export const Incomplete: Story = {
  args: {
    tracks: [
      { reference: "track:one", duration_ms: 125_000 },
      { reference: "track:two", duration_ms: null },
    ],
  },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByLabelText("Durée totale")).toHaveTextContent(
      "2:05 · 1 durées inconnues",
    );
  },
};
export const Unknown: Story = {
  args: { tracks: [{ reference: "track:one", duration_ms: null }] },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByLabelText("Durée totale")).toHaveTextContent("Inconnue");
  },
};
