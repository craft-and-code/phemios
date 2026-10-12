import { t } from "../i18n";
/** Application references retain catalog ownership without changing Aède identities. */
export type SourceId = "local" | "server";
/** Only the qualifier after the entity kind chooses an owner; engine keys remain literal. */
export function referenceSource(reference: string): SourceId {
  const colon = reference.indexOf(":");
  return colon > 0 && reference.startsWith("@phemios/local/", colon + 1) ? "local" : "server";
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
