/** Stable public section identities are shared by account preferences and website hosts. */
export const analysisSectionIds = [
  "integrity",
  "detection",
  "identity",
  "measurements",
  "technical",
  "coverage",
  "fingerprints",
] as const;
export type AnalysisSection = (typeof analysisSectionIds)[number];
/** Reject unknown/duplicate entries instead of silently replacing an unreadable preference. */
export function validAnalysisSections(value: unknown): value is AnalysisSection[] {
  return (
    Array.isArray(value) &&
    value.length <= analysisSectionIds.length &&
    new Set(value).size === value.length &&
    value.every((id) => analysisSectionIds.includes(id))
  );
}
/** Preserve independent disclosures while keeping serialized order deterministic. */
export function changeAnalysisSection(
  current: readonly AnalysisSection[],
  id: AnalysisSection,
  open: boolean,
): AnalysisSection[] {
  return analysisSectionIds.filter((key) => (key === id ? open : current.includes(key)));
}
