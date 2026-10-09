import { t } from "../i18n";
export interface PlayerVolume {
  name: string;
  path: string;
  format: string;
  kind: "volume" | "network" | "removable";
}
/** Discovery is bounded mount evidence, never a claimed codec profile or write permission. */
export function parsePlayers(value: unknown): PlayerVolume[] {
  if (!Array.isArray(value) || value.length > 256)
    throw Error(t("Détection des lecteurs illisible."));
  const seen = new Set<string>();
  return value.map((value) => {
    const row = value as PlayerVolume;
    if (
      !row ||
      typeof row.name !== "string" ||
      typeof row.path !== "string" ||
      row.path.length > 4096 ||
      !(row.path.startsWith("/") || /^[a-z]:\\$/i.test(row.path)) ||
      typeof row.format !== "string" ||
      !["volume", "network", "removable"].includes(row.kind) ||
      seen.has(row.path)
    )
      throw Error(t("Détection des lecteurs illisible."));
    seen.add(row.path);
    return row;
  });
}
