import { expect, it } from "vitest";
import { analysisModel, parseAnalysisDocument, ANALYSIS_IMPORT_FILES } from "./model";
const file = () => ({
  file_name: "track.flac",
  format: "FLAC",
  sample_rate: 96000,
  channels: 2,
  declared_bits: 24,
  real_bit_depth: 16,
  bit_depth_evidence: { stored_bits: 16 },
  flac_md5: { state: "Match" },
  detections: { summary: "Flagged", upscaling: true, upsampling: true, transcoding: true },
});
it("keeps independently cumulative detection, exact bit occupancy, real format and historical MD5", () => {
  const value = analysisModel({ ...file(), ext_mismatch: true });
  expect(value.labels).toEqual(["Upscaled", "Upsampled", "Transcoded"]);
  expect(value.md5State).toBe("Match");
  expect(value.stale).toBeUndefined();
  expect(value.bits).toBe(24);
  expect(value.stored).toBe(16);
  expect(value.extensionMismatch).toBe(true);
});
it("accepts album and individual exports without opening paths or granting freshness", () => {
  for (const document of [
    file(),
    { root: "/unopened", files: [file()], has_flac: true },
    {
      format: "flaccompagnon-report",
      version: 1,
      report: { root: "/unopened", files: [file()], has_flac: true },
    },
  ]) {
    const rows = parseAnalysisDocument(JSON.stringify(document));
    expect(rows).toHaveLength(1);
    expect(analysisModel(rows[0]).stale).toBeUndefined();
  }
});
it("refuses foreign, empty, oversized, future-version and malformed reports", () => {
  for (const value of [
    {},
    [],
    { files: [] },
    { format: "flaccompagnon-report", version: 2, report: { files: [file()] } },
    { files: Array(ANALYSIS_IMPORT_FILES + 1).fill(file()) },
    { ...file(), channels: 1.5 },
    { ...file(), detections: { transcoding: "yes" } },
    { ...file(), phase_correlation: 2 },
  ])
    expect(() => parseAnalysisDocument(JSON.stringify(value))).toThrow();
  expect(() => parseAnalysisDocument("not json")).toThrow();
  expect(() => parseAnalysisDocument('"' + "x".repeat(16 * 1024 * 1024) + '"')).toThrow(/16 Mio/);
});
it("keeps no-signature, unperformed checks and failed zero-rate decodes distinct", () => {
  const unknown = analysisModel({
    source: "flaccompagnon",
    source_data: { flac_md5: { state: "NoSignature" } },
  });
  expect(unknown.labels).toEqual(["Non analysé"]);
  expect(unknown.channels).toBeUndefined();
  expect(unknown.extensionMismatch).toBeUndefined();
  const failed = analysisModel({ ...file(), sample_rate: 0, channels: 0, error: "Decode stopped" });
  expect(failed.error).toBe("Decode stopped");
  expect(failed.rate).toBeUndefined();
  const ogg = analysisModel({
    ...file(),
    format: "OGG",
    codec: "Vorbis",
    declared_bits: null,
    real_bit_depth: null,
  });
  expect(ogg.applicableMd5).toBe(false);
  expect(ogg.bits).toBeUndefined();
});

it("does not publish unrequested false placeholders as completed checks", () => {
  const model = analysisModel({
    ...file(),
    analyses_run: ["fingerprints"],
    format: "",
    sample_rate: 0,
    clipping: { clipped: false },
    discontinuities: { clicks: { count: 0, events: [] }, dropouts: { count: 0, events: [] } },
  });
  expect(model.md5State).toBe("");
  expect(model.clipped).toBeUndefined();
  expect(model.labels).toEqual(["Non analysé"]);
  expect(model.checks.every((check) => check.value === undefined)).toBe(true);
  expect(model.eventCount).toBeUndefined();
  expect(
    parseAnalysisDocument(
      JSON.stringify({ ...file(), format: "", sample_rate: 0, analyses_run: ["fingerprints"] }),
    ),
  ).toHaveLength(1);
});

it("rejects oversized identity text, malformed digests and invalid coverage", () => {
  for (const value of [
    { ...file(), file_name: "x".repeat(1025) },
    { ...file(), file_md5: "invalid" },
    { ...file(), file_crc32: "../abc" },
    { ...file(), analyses_run: [false] },
  ])
    expect(() => analysisModel(value)).toThrow();
});

it("never accepts current-file freshness or server summary fallbacks from imported JSON", () => {
  const imported = analysisModel(
    parseAnalysisDocument(JSON.stringify({ ...file(), stale: false }))[0],
  );
  expect(imported.stale).toBeUndefined();
  const partial = analysisModel({
    source: "flaccompagnon",
    stale: false,
    summary: "Clean",
    clipped: false,
    md5_state: "Match",
    source_data: { ...file(), analyses_run: ["fingerprints"] },
  });
  expect(partial.labels).toEqual(["Non analysé"]);
  expect(partial.md5State).toBe("");
  expect(partial.clipped).toBeUndefined();
});
it("does not project out-of-track events into invented timeline positions", () => {
  expect(() =>
    analysisModel({
      ...file(),
      duration_secs: 5,
      discontinuities: {
        clicks: { count: 1, events: [{ start_secs: 6, duration_secs: 0.1, channel: 1 }] },
      },
    }),
  ).toThrow();
});
