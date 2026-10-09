/** Application references retain catalog ownership without changing Aède identities. */
export type SourceId = "local" | "server";
export function referenceSource(reference: string): SourceId {
  return reference.includes(":@phemios/local/") ? "local" : "server";
}
export const sourceLabel = (source: SourceId) => (source === "local" ? "Local" : "Serveur");
