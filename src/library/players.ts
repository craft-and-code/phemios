import { t } from "../i18n";
export interface PlayerVolume {
  id?: string;
  adapter?: "mounted" | "ipod" | "mtp";
  available?: boolean;
  free?: number;
  model?: string | null;
  icon?: string;
  ipodSupported?: boolean | null;
  ejectable?: boolean;
  unavailableReason?: string;
  name: string;
  path: string;
  format: string;
  kind: "volume" | "network" | "removable" | "folder";
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
      !(
        row.path.startsWith("/") ||
        /^[a-z]:\\/i.test(row.path) ||
        /^\\\\[^\\]+\\[^\\]+/.test(row.path) ||
        (row.adapter === "mtp" && row.path.startsWith("mtp:"))
      ) ||
      typeof row.format !== "string" ||
      !["volume", "network", "removable", "folder"].includes(row.kind) ||
      (row.id !== undefined &&
        (typeof row.id !== "string" || !/^(mount|mtp):[0-9]+$/.test(row.id))) ||
      (row.adapter !== undefined && !["mounted", "ipod", "mtp"].includes(row.adapter)) ||
      (row.available !== undefined && typeof row.available !== "boolean") ||
      (row.free !== undefined && (!Number.isSafeInteger(row.free) || row.free < 0)) ||
      (row.model !== undefined &&
        row.model !== null &&
        (typeof row.model !== "string" || row.model.length > 80)) ||
      (row.icon !== undefined &&
        ![
          "drive",
          "folder",
          "ipod",
          "ipod-nano",
          "ipod-square",
          "ipod-touch",
          "ipod-shuffle",
        ].includes(row.icon)) ||
      (row.ipodSupported !== undefined &&
        row.ipodSupported !== null &&
        typeof row.ipodSupported !== "boolean") ||
      (row.ejectable !== undefined && typeof row.ejectable !== "boolean") ||
      (row.unavailableReason !== undefined &&
        (typeof row.unavailableReason !== "string" || row.unavailableReason.length > 512)) ||
      seen.has(row.path)
    )
      throw Error(t("Détection des lecteurs illisible."));
    seen.add(row.path);
    return row;
  });
}

/** New native discovery retains separate warnings so one unavailable MTP backend cannot hide mounts. */
export function parsePlayerDiscovery(value: unknown): { volumes: PlayerVolume[]; warning: string } {
  if (Array.isArray(value)) return { volumes: parsePlayers(value), warning: "" };
  if (!value || typeof value !== "object") throw Error(t("Détection des lecteurs illisible."));
  const row = value as Record<string, unknown>;
  if (typeof row.warning !== "string") throw Error(t("Détection des lecteurs illisible."));
  return { volumes: parsePlayers(row.volumes), warning: row.warning };
}
