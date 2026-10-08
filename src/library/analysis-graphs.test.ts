import { expect, it } from "vitest";
import { analysisGraphs } from "./analysis-graphs";
it("plots measured values and phase bands without treating missing measurements as zero", () => {
  const result = analysisGraphs({
    source: "flaccompagnon",
    stale: false,
    source_data: {
      sample_rate: 44100,
      integrated_lufs: -14,
      dr_db: 8,
      declared_bits: 24,
      real_bit_depth: 16,
      clipping: { peak_dbfs: -1, true_peak_dbtp: 0.2 },
      local_phase: { bands: [{ low_hz: 20, high_hz: 200, summary: { correlation: -0.5 } }] },
    },
  });
  expect(result.gauges.find((row) => row.label === "Niveau intégré")?.value).toBe(-14);
  expect(result.gauges.find((row) => row.label === "Coupure spectrale")).toBeUndefined();
  expect(result.gauges.find((row) => row.label.includes("20–200"))?.value).toBe(-0.5);
  expect(result.stale).toBe(false);
  expect(result.eventCount).toBeUndefined();
});
it("keeps total event counts separate from a bounded retained timeline", () => {
  const events = Array.from({ length: 1500 }, (_, i) => ({
    start_secs: i / 10,
    duration_secs: 0.001,
    channel: 1,
  }));
  const result = analysisGraphs({
    source: "flaccompagnon",
    stale: true,
    source_data: {
      duration_secs: 200,
      discontinuities: { clicks: { count: 5000, events }, dropouts: { count: 0, events: [] } },
    },
  });
  expect(result.events).toHaveLength(1000);
  expect(result.eventCount).toBe(5000);
  expect(result.retainedEvents).toBe(1500);
  expect(result.stale).toBe(true);
});
it("rejects malformed finite/range values rather than drawing fictitious graphs", () => {
  expect(() => analysisGraphs({ source: "flaccompagnon", source_data: { dr_db: NaN } })).toThrow();
  expect(() =>
    analysisGraphs({ source: "flaccompagnon", source_data: { phase_correlation: 2 } }),
  ).toThrow();
  expect(
    analysisGraphs({ source: "flaccompagnon", dr_db: 10, source_data: null }).gauges[0]?.value,
  ).toBe(10);
});
