interface Gauge {
  label: string;
  unit: string;
  value: number;
  low: number;
  high: number;
}
interface Event {
  start: number;
  duration: number;
  channel: number;
  kind: string;
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("Données FlacCompagnon invalides.");
  return value as Record<string, unknown>;
}
function number(value: unknown, low = -Infinity, high = Infinity): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error("Mesure FlacCompagnon invalide.");
  return value;
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
/** Graph only retained measurements; missing values and truncated event lists remain explicit. */
export function analysisGraphs(value: unknown) {
  const row = object(value),
    data = row.source_data ? object(row.source_data) : row;
  if (row.source !== "flaccompagnon") throw new Error("Source d’analyse non prise en charge.");
  const clipping = object(data.clipping),
    detections = object(data.detections);
  const gauges: Gauge[] = [],
    missing: string[] = [];
  function add(
    label: string,
    unit: string,
    value: unknown,
    low: number,
    high: number,
    validLow = -Infinity,
    validHigh = Infinity,
  ) {
    const measured = number(value, validLow, validHigh);
    if (measured !== undefined) gauges.push({ label, unit, value: measured, low, high });
    else missing.push(label);
  }
  add("Niveau intégré", "LUFS", data.integrated_lufs, -60, 0);
  add("Dynamique", "dB DR", data.dr_db, 0, 30, 0);
  add("Étendue de sonie", "LU", data.loudness_range_lu, 0, 30, 0);
  add("Crête échantillon", "dBFS", clipping.peak_dbfs ?? data.peak_dbfs, -60, 3);
  add("Crête vraie", "dBTP", clipping.true_peak_dbtp ?? data.true_peak_dbtp, -60, 3);
  add("Précision déclarée", "bits", data.declared_bits, 0, 32, 0, 64);
  add("Précision mesurée", "bits", data.real_bit_depth, 0, 32, 0, 64);
  const rate = number(data.sample_rate, 1);
  if (rate) add("Coupure spectrale", "Hz", data.cutoff_hz, 0, rate / 2, 0);
  else missing.push("Coupure spectrale");
  add("Corrélation stéréo", "", data.phase_correlation, -1, 1, -1, 1);
  add("Balance D/G", "dB", object(data.stereo_balance).right_minus_left_db, -12, 12);
  const phase = object(data.local_phase);
  if (phase.bands !== undefined && !Array.isArray(phase.bands))
    throw new Error("Bandes de phase invalides.");
  for (const value of (phase.bands as unknown[] | undefined)?.slice(0, 16) ?? []) {
    const band = object(value),
      low = number(band.low_hz, 0),
      high = number(band.high_hz, 0);
    if (low !== undefined && high !== undefined)
      add(`Phase ${low}–${high} Hz`, "", object(band.summary).correlation, -1, 1, -1, 1);
  }
  if (!(phase.bands as unknown[] | undefined)?.length) missing.push("Phase par bandes");
  const duration = number(data.duration_secs, 0),
    discontinuities = object(data.discontinuities);
  let eventCount = 0,
    completeCount = true,
    retainedEvents = 0;
  const events: Event[] = [];
  for (const [key, label] of [
    ["clicks", "Clic"],
    ["dropouts", "Coupure"],
  ]) {
    const group = object(discontinuities[key ?? ""]),
      count = number(group.count, 0, Number.MAX_SAFE_INTEGER);
    if (count !== undefined && !Number.isInteger(count))
      throw new Error("Nombre d’événements invalide.");
    if (count === undefined) completeCount = false;
    eventCount += count ?? 0;
    if (!Number.isSafeInteger(eventCount)) throw new Error("Nombre d’événements trop grand.");
    if (group.events !== undefined && !Array.isArray(group.events))
      throw new Error("Événements invalides.");
    const retained = (group.events as unknown[] | undefined) ?? [];
    retainedEvents += retained.length;
    for (const value of retained.slice(0, Math.max(0, 1000 - events.length))) {
      const event = object(value),
        start = number(event.start_secs, 0),
        length = number(event.duration_secs, 0),
        channel = number(event.channel, 1);
      if (
        start === undefined ||
        length === undefined ||
        channel === undefined ||
        !Number.isInteger(channel)
      )
        throw new Error("Position d’événement invalide.");
      events.push({ start, duration: length, channel, kind: label ?? "Événement" });
    }
  }
  return {
    gauges,
    missing,
    events,
    duration,
    eventCount: completeCount ? eventCount : undefined,
    retainedEvents,
    stale: typeof row.stale === "boolean" ? row.stale : undefined,
    summary: text(detections.summary ?? row.summary),
    detail: text(detections.detail ?? row.detail),
    error: text(data.error ?? row.error),
    md5: text(object(data.flac_md5).state ?? row.md5_state),
    clipped:
      typeof clipping.clipped === "boolean"
        ? clipping.clipped
        : typeof row.clipped === "boolean"
          ? row.clipped
          : undefined,
  };
}
