import { t } from "../i18n";
import { publicMediaAddress } from "../platform/public-media-address";
export interface Station {
  uuid: string;
  name: string;
  country: string;
  countryCode?: string;
  tags: string;
  codec: string;
  bitrate: number;
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(t("Réponse radio invalide."));
  return value as Record<string, unknown>;
};
/** Page through the live directory, never claiming every entry is a unique or available broadcast. */
export function parseStations(value: unknown) {
  if (!Array.isArray(value) || value.length > 51) throw new Error(t("Page de stations invalide."));
  const stations = value.slice(0, 50).map((value: unknown): Station => {
    const row = object(value);
    const text = (key: string) => {
      if (typeof row[key] !== "string" || row[key].length > 4096)
        throw new Error(t("Station radio invalide."));
      return row[key];
    };
    const uuid = text("stationuuid");
    if (
      !uuidPattern.test(uuid) ||
      typeof row.bitrate !== "number" ||
      !Number.isSafeInteger(row.bitrate) ||
      row.bitrate < 0
    )
      throw new Error(t("Station radio invalide."));
    return {
      uuid,
      name: text("name"),
      ...(typeof row.countrycode === "string" && /^[A-Z]{2}$/.test(row.countrycode)
        ? { countryCode: row.countrycode }
        : {}),
      country:
        typeof row.countrycode === "string" && /^[A-Z]{2}$/.test(row.countrycode)
          ? (new Intl.DisplayNames(["fr"], { type: "region" }).of(row.countrycode) ??
            text("country"))
          : text("country"),
      tags: text("tags"),
      codec: text("codec"),
      bitrate: row.bitrate,
    };
  });
  return { stations, more: value.length === 51 };
}
/** Streams are explicitly selected HTTP(S) media; reject credentials, local literals and pseudo-protocols. */
export function streamUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 8192)
    throw new Error(t("Adresse du flux invalide."));
  const url = publicMediaAddress(value, 8192);
  if (!url)
    throw new Error(t("Cette station ne fournit pas de flux Internet HTTP/HTTPS utilisable."));
  return url.href;
}
/** The click response must still identify the station the user selected. */
export function parseResolved(value: unknown, uuid: string): string {
  const row = object(value);
  if (row.stationuuid !== uuid)
    throw new Error(t("La station résolue ne correspond pas à la sélection."));
  return streamUrl(row.url);
}
export function stationCount(value: unknown): number {
  const count = object(value).stations;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
    throw new Error(t("Nombre de stations indisponible."));
  return count;
}
