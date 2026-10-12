import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { AnalysisCharts } from "../../../src/components/AnalysisCharts";
const meta = {
  title: "Data/AnalysisCharts",
  component: AnalysisCharts,
  args: {
    analysis: {
      source: "flaccompagnon",
      stale: false,
      source_data: {
        sample_rate: 44100,
        duration_secs: 200,
        integrated_lufs: -14,
        dr_db: 8,
        declared_bits: 24,
        real_bit_depth: 16,
        clipping: { peak_dbfs: -1, true_peak_dbtp: 0.2 },
      },
    },
  },

  parameters: {
    docs: {
      description: {
        component:
          "Actual presentation component with fictional values; no account or native action.",
      },
    },
  },
} satisfies Meta<typeof AnalysisCharts>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Partial: Story = {
  args: { analysis: { source: "flaccompagnon", stale: true, source_data: { dr_db: 9 } } },
};
export const Invalid: Story = {
  args: { analysis: { source: "flaccompagnon", source_data: { phase_correlation: 2 } } },
};
