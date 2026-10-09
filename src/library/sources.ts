import { t } from "../i18n";
/** Application references retain catalog ownership without changing Aède identities. */
export type SourceId = "local" | "server";
export function referenceSource(reference: string): SourceId {
  return reference.includes(":@phemios/local/") ? "local" : "server";
}
export const sourceLabel = (source: SourceId) => (source === "local" ? t("Local") : t("Serveur"));

/** Origins reflect the retained catalog, so a disconnected source does not lose its label. */
export function catalogOrigins(references: readonly string[]): SourceId[] {
  const found = new Set(references.map(referenceSource));
  return (["local", "server"] as const).filter((source) => found.has(source));
}
/** Personal views follow the sole active source; an explicit choice applies only when necessary. */
export function effectiveSource(
  selected: SourceId,
  active: readonly SourceId[],
  retained: readonly SourceId[],
): SourceId {
  return active.length === 1
    ? active[0]!
    : active.length
      ? selected
      : retained.length === 1
        ? retained[0]!
        : selected;
}
