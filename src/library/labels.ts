import { t } from "../i18n";
import { referenceSource, type SourceId } from "./sources";
export interface LabelSummary {
  reference: string;
  name: string;
  releaseCount: number;
  logo?: boolean;
}
export interface LabelDetail {
  reference: string;
  name: string;
  releases: string[];
  logo?: boolean;
  biography?: { text: string; url: string; lang: string; licence: string; source: string };
}
/** Labels retain their exact source-qualified identity and their known album count. */
export function parseLabel(raw: unknown): LabelSummary {
  const row = raw as Record<string, unknown>;
  if (
    !row ||
    typeof row.reference !== "string" ||
    !row.reference.startsWith("label:") ||
    typeof row.name !== "string" ||
    !Number.isSafeInteger(row.release_count) ||
    Number(row.release_count) < 0
  )
    throw new Error(t("Label Aède invalide."));
  return {
    reference: row.reference,
    name: row.name,
    releaseCount: Number(row.release_count),
    ...logoPresence(row),
  };
}
/** Omission means an older engine; present malformed availability is never treated as absence. */
function logoPresence(row: Record<string, unknown>): { logo?: boolean } {
  if (row.logo === undefined) return {};
  if (typeof row.logo !== "boolean") throw new Error(t("Label Aède invalide."));
  return { logo: row.logo };
}
/** Licensed prose is inseparable from its attribution; HTML is never rendered from it. */
export function parseLabelDetail(raw: unknown, reference: string): LabelDetail {
  const row = raw as Record<string, unknown>;
  if (
    !row ||
    row.reference !== reference ||
    typeof row.name !== "string" ||
    !Array.isArray(row.releases) ||
    row.releases.length > 100000 ||
    row.releases.some(
      (ref) =>
        typeof ref !== "string" ||
        !ref.startsWith("release:") ||
        referenceSource(ref) !== referenceSource(reference),
    )
  )
    throw new Error(t("Label Aède invalide."));
  let biography: LabelDetail["biography"];
  if (row.biography !== undefined && row.biography !== null) {
    const prose = row.biography as NonNullable<LabelDetail["biography"]>;
    if (
      !prose ||
      ![prose.text, prose.url, prose.lang, prose.licence, prose.source].every(
        (v) => typeof v === "string",
      )
    )
      throw new Error(t("Biographie Aède invalide."));
    biography = prose;
  }
  return {
    reference,
    name: row.name,
    releases: row.releases as string[],
    ...logoPresence(row as Record<string, unknown>),
    ...(biography ? { biography } : {}),
  };
}
/** One bounded list window per source; invalid epochs and duplicate identities fail explicitly. */
export function parseLabelPage(raw: unknown, offset: number, source: SourceId, epoch?: number) {
  const page = raw as { items: unknown[]; total: number; offset: number; scanned_at: number };
  if (
    !page ||
    !Array.isArray(page.items) ||
    page.items.length > 50 ||
    !Number.isSafeInteger(page.total) ||
    page.total < 0 ||
    !Number.isSafeInteger(page.scanned_at) ||
    page.scanned_at < 0 ||
    (page.total < offset + page.items.length && page.items.length > 0) ||
    page.offset !== offset ||
    (epoch !== undefined && page.scanned_at !== epoch)
  )
    throw new Error(t("Page de labels Aède invalide."));
  const items = page.items.map(parseLabel);
  if (
    new Set(items.map((r) => r.reference)).size !== items.length ||
    items.some((r) => referenceSource(r.reference) !== source)
  )
    throw new Error(t("Page de labels Aède invalide."));
  return { items, total: page.total };
}
