import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, within } from "storybook/test";
import { TrackResultPanel } from "../../../src/components/TrackResultPanel";
import { AnalysisCharts } from "../../../src/components/AnalysisCharts";
import { Icon } from "../../../src/components/Icon";
const meta = {
  title: "Data/TrackResultPanel",
  component: TrackResultPanel,
  args: { title: "Spectre", children: undefined },
} satisfies Meta<typeof TrackResultPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AnalysisAndSpectrum: Story = {
  render: () => (
    <section
      style={{
        display: "grid",
        "grid-template-columns": "repeat(2, minmax(0, 1fr))",
        gap: "16px",
        "align-items": "start",
      }}
    >
      <TrackResultPanel label="Analyse FlacCompagnon">
        <AnalysisCharts
          analysis={{
            source: "flaccompagnon",
            stale: false,
            source_data: {
              format: "FLAC",
              flac_md5: { state: "Match" },
              sample_rate: 44100,
              duration_secs: 200,
              integrated_lufs: -14,
              dr_db: 8,
            },
          }}
        />
      </TrackResultPanel>
      <TrackResultPanel
        title="Spectre"
        framed
        actions={
          <button class="icon-button quiet" aria-label="Télécharger le spectre">
            <Icon name="download" />
          </button>
        }
      >
        <svg class="spectrum" role="img" aria-label="Fictional spectrum" viewBox="0 0 600 160">
          <rect width="600" height="160" fill="#151a18" />
          <path
            d="M0 130 L50 20 L100 80 L150 35 L200 100 L250 50 L300 110 L350 85 L400 125 L450 95 L500 130 L550 120 L600 140"
            fill="none"
            stroke="currentColor"
          />
        </svg>
      </TrackResultPanel>
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText("Analyse FlacCompagnon", { exact: true })).toBeNull();
    const analysis = canvasElement.querySelector(".flac-analysis-report")!;
    const integrity = canvas.getByRole("region", { name: "Intégrité audio" });
    expect(getComputedStyle(integrity).borderTopLeftRadius).toBe("0px");
    expect(getComputedStyle(integrity).borderBottomLeftRadius).toBe("0px");
    const image = canvas.getByRole("img", { name: "Fictional spectrum" }),
      frame = image.closest(".track-result-panel")!;
    const spectrumHeading = canvas
      .getByText("Spectre", { exact: true })
      .closest(".analysis-result-heading")!;
    expect(Math.round(analysis.getBoundingClientRect().top)).toBe(
      Math.round(frame.getBoundingClientRect().top),
    );
    expect(
      Math.round(
        image.getBoundingClientRect().top - spectrumHeading.getBoundingClientRect().bottom,
      ),
    ).toBe(16);
    expect(parseFloat(getComputedStyle(frame).borderTopWidth)).toBe(1);
    expect(
      within(frame as HTMLElement).getByRole("button", { name: "Télécharger le spectre" }),
    ).toBeVisible();
  },
};
