import { selectedMeasurements } from "./coverage";
import { analysisMeasurements } from "./measurements";
export type AnalysisRecord = Record<string, unknown>;
/** Input size/track bounds are shared by browser/native imports; no imported path is opened. */
export const ANALYSIS_IMPORT_BYTES = 16 * 1024 * 1024;
export const ANALYSIS_IMPORT_FILES = 2000;
export function record(value: unknown): AnalysisRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Données FlacCompagnon invalides.");
  return value as AnalysisRecord;
}
export const text = (value: unknown): string => (typeof value === "string" ? value : "");
function optionalRecord(value: unknown): AnalysisRecord {
  return value === null || value === undefined ? {} : record(value);
}
function measured(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error("Mesure FlacCompagnon invalide.");
  return value;
}
function flag(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error("Données FlacCompagnon invalides.");
  return value;
}
/** A report describes its analyzed bytes; absent freshness never certifies the current audio file. */
export function analysisModel(value: unknown) {
  const row = record(value);
  if (row.source !== undefined && row.source !== "flaccompagnon")
    throw new Error("Source d’analyse non prise en charge.");
  const data = selectedMeasurements(row.source_data == null ? row : record(row.source_data));
  for (const [key, limit] of Object.entries({
    file_name: 1024,
    path: 16384,
    format: 64,
    codec: 128,
    error: 16384,
  })) {
    const value = data[key];
    if (value != null && (typeof value !== "string" || value.length > limit))
      throw new Error("Données FlacCompagnon invalides.");
  }
  const graph = analysisMeasurements({ ...row, source: "flaccompagnon", source_data: data });
  const detection = optionalRecord(data.detections),
    clipping = optionalRecord(data.clipping);
  const md5 = optionalRecord(data.flac_md5),
    evidence = optionalRecord(data.bit_depth_evidence);
  const format = text(data.format),
    filename = text(data.file_name) || text(data.path).split(/[\\/]/).pop() || "";
  const channels = measured(data.channels, 0, 64),
    bits = measured(data.declared_bits, 0, 64);
  const effective = measured(data.real_bit_depth, 0, 64),
    stored = measured(evidence.stored_bits, 0, 64);
  for (const value of [channels, bits, effective, stored])
    if (value !== undefined && !Number.isInteger(value))
      throw new Error("Mesure FlacCompagnon invalide.");
  const md5State = text(md5.state) || (data.analyses_run == null ? text(row.md5_state) : "");
  if (md5State && !["Match", "Mismatch", "NoSignature", "Present", "Error"].includes(md5State))
    throw new Error("État MD5 FlacCompagnon invalide.");
  if (text(detection.detail).length > 32768 || text(md5.detail).length > 16384)
    throw new Error("Données FlacCompagnon invalides.");
  for (const [field, pattern] of [
    ["file_md5", /^[a-f0-9]{32}$/i],
    ["file_crc32", /^[a-f0-9]{8}$/i],
  ] as const)
    if (data[field] != null && !pattern.test(text(data[field])))
      throw new Error("Empreinte de fichier invalide.");
  const peaks = optionalRecord(data.loudness_peaks);
  const loudnessPeaks = ["momentary", "short_term"].flatMap((kind) => {
    const peak = optionalRecord(peaks[kind]),
      lufs = measured(peak.lufs, -Infinity, Infinity),
      start = measured(peak.start_secs);
    return lufs === undefined || start === undefined ? [] : [{ kind, lufs, start }];
  });
  const dc = measured(optionalRecord(data.dc_offset).max_abs);
  const lattice = measured(data.lattice_score, 0, 1);
  const checks = [
    { key: "upscaling", label: "Upscaled", name: "Profondeur artificiellement augmentée" },
    { key: "upsampling", label: "Upsampled", name: "Suréchantillonnage" },
    { key: "transcoding", label: "Transcoded", name: "Transcodage avec pertes" },
  ].map((check) => ({ ...check, value: flag(detection[check.key]) }));
  const labels = checks.filter((check) => check.value === true).map((check) => check.label);
  const summary = text(detection.summary ?? (data.analyses_run == null ? row.summary : undefined));
  if (!labels.length)
    labels.push(
      summary === "Clean" ? "Clean" : summary === "Flagged" ? "Indices détectés" : "Non analysé",
    );
  return {
    ...graph,
    data,
    loudnessPeaks,
    dc,
    lattice,
    filename,
    format,
    codec: text(data.codec),
    channels: channels || undefined,
    bits,
    effective,
    stored,
    integerDepthApplicable:
      !/^(MP3|AAC)$/i.test(format) && !/vorbis|opus|aac|mp3/i.test(text(data.codec)),
    bitMethod: text(evidence.method),
    checks,
    labels,
    md5State,
    md5Detail: text(md5.detail),
    applicableMd5: !format || format.toUpperCase() === "FLAC",
    extension: filename.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase(),
    extensionMismatch: format ? flag(data.ext_mismatch) : undefined,
    rate: measured(data.sample_rate) || undefined,
    size: measured(data.size_bytes) || undefined,
    bitrate: measured(data.bitrate_kbps),
    dualMono: flag(data.fake_stereo),
    inverted: flag(data.phase_inverted),
    correlation: measured(data.phase_correlation, -1, 1),
    balance: measured(optionalRecord(data.stereo_balance).right_minus_left_db, -Infinity, Infinity),
    cutoff: measured(data.cutoff_hz),
    clipped: flag(clipping.clipped ?? (data.analyses_run == null ? row.clipped : undefined)),
    clippedSamples: measured(clipping.clipped_samples),
    clipEvents: measured(clipping.clip_events),
    fileMd5: text(data.file_md5),
    crc32: text(data.file_crc32),
    coverage: Array.isArray(data.analyses_run)
      ? data.analyses_run.filter((value): value is string => typeof value === "string")
      : undefined,
  };
}
export type AnalysisModel = ReturnType<typeof analysisModel>;
/** Accept current versioned exports, legacy folder reports and an individual FileAnalysis, never unrelated JSON. */
export function parseAnalysisDocument(document: string): unknown[] {
  if (
    document.length > ANALYSIS_IMPORT_BYTES ||
    new TextEncoder().encode(document).length > ANALYSIS_IMPORT_BYTES
  )
    throw new Error("Le rapport dépasse la limite de 16 Mio.");
  let value: unknown;
  try {
    value = JSON.parse(document);
  } catch {
    throw new Error("Le fichier JSON est illisible.");
  }
  const root = record(value);
  let report = root;
  if (root.format === "flaccompagnon-report") {
    if (root.version !== 1)
      throw new Error("Version de rapport FlacCompagnon non prise en charge.");
    report = record(root.report);
  } else if ("version" in root || "report" in root) {
    throw new Error("Rapport FlacCompagnon non reconnu.");
  }
  const files = Array.isArray(report.files) ? report.files : [report];
  if (!files.length || files.length > ANALYSIS_IMPORT_FILES)
    throw new Error("Le rapport doit contenir entre 1 et 2 000 fichiers.");
  for (const file of files) {
    const row = record(file);
    if (!text(row.file_name) || typeof row.format !== "string" || row.source_data !== undefined)
      throw new Error("Rapport FlacCompagnon non reconnu.");
    analysisModel(file);
  }
  // Freshness belongs to Aède, never to an imported document or caller-supplied file fields.
  return files.map((file) => ({ source: "flaccompagnon", source_data: file }));
}
