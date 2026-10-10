import { t } from "../i18n";
export interface CoverageCounts {
  current: number;
  stale: number;
  failed: number;
  missing: number;
}
export interface IntegrityCounts {
  ok: number;
  ko: number;
  no_hash: number;
  unchecked: number;
  unsupported: number;
  stale: number;
  md5: number;
  crc: number;
}
export interface CoverageAlbum extends CoverageCounts {
  reference: string;
  title: string;
  artist: string | null;
  tracks: number;
  spectra: number;
  integrity?: IntegrityCounts;
}
export interface CoveragePage {
  items: CoverageAlbum[];
  total: number;
  offset: number;
  scanned_at: number;
  summary: CoverageCounts & { files: number };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(t("Couverture des analyses invalide."));
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw Error(t("Couverture des analyses invalide."));
  return Number(value);
}
function counts(row: Record<string, unknown>, total: number): CoverageCounts {
  const values = {
    current: count(row.current),
    stale: count(row.stale),
    failed: count(row.failed),
    missing: count(row.missing),
  };
  if (Object.values(values).reduce((a, b) => a + b, 0) !== total)
    throw Error(t("Couverture des analyses invalide."));
  return values;
}
function integrity(value: unknown, total: number): IntegrityCounts | undefined {
  if (value === undefined) return;
  const row = object(value);
  const result = Object.fromEntries(
    ["ok", "ko", "no_hash", "unchecked", "unsupported", "stale", "md5", "crc"].map((key) => [
      key,
      count(row[key]),
    ]),
  ) as unknown as IntegrityCounts;
  if (
    result.ok +
      result.ko +
      result.no_hash +
      result.unchecked +
      result.unsupported +
      result.stale !==
      total ||
    result.md5 + result.crc > total
  )
    throw Error(t("Couverture des analyses invalide."));
  return result;
}
/** Complete lightweight pages distinguish unavailable/stale data from measured zero coverage. */
export function parseCoverage(
  value: unknown,
  offset: number,
  epoch: number | undefined,
): CoveragePage {
  const row = object(value),
    total = count(row.total),
    scanned = count(row.scanned_at),
    summary = object(row.summary),
    files = count(summary.files);
  if (
    row.offset !== offset ||
    row.limit !== 50 ||
    (epoch !== undefined && scanned !== epoch) ||
    !Array.isArray(row.items) ||
    row.items.length !== Math.min(50, Math.max(0, total - offset))
  )
    throw Error(t("Le catalogue a changé ; resynchronisez la bibliothèque."));
  const seen = new Set<string>();
  const items = row.items.map((value) => {
    const item = object(value),
      tracks = count(item.tracks),
      spectra = count(item.spectra);
    if (
      typeof item.reference !== "string" ||
      !item.reference.startsWith("release:") ||
      seen.has(item.reference) ||
      typeof item.title !== "string" ||
      !(item.artist === null || typeof item.artist === "string") ||
      spectra > tracks
    )
      throw Error(t("Couverture des analyses invalide."));
    seen.add(item.reference);
    return {
      reference: item.reference,
      title: item.title,
      artist: item.artist,
      tracks,
      spectra,
      ...counts(item, tracks),
      ...(item.integrity === undefined ? {} : { integrity: integrity(item.integrity, tracks)! }),
    };
  });
  return {
    items,
    total,
    offset,
    scanned_at: scanned,
    summary: { files, ...counts(summary, files) },
  };
}
