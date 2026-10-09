import { createSignal } from "solid-js";
import { t } from "../i18n";
import { parseStations, type Station } from "./directory";
type Store = Pick<Storage, "getItem" | "setItem">;
const key = "phemios.radio-favourites.v1";
function station(value: unknown): Station {
  const row = value as Station;
  if (!row || typeof row !== "object") throw new Error(t("Favoris radio illisibles."));
  return parseStations([
    {
      stationuuid: row.uuid,
      name: row.name,
      country: row.country,
      countrycode: row.countryCode,
      tags: row.tags,
      codec: row.codec,
      bitrate: row.bitrate,
    },
  ]).stations[0]!;
}
/** Persist public station identities, never stream URLs, bearer tokens or Aède annotations. */
export function readRadioFavourites(storage: Store): Station[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > 2 * 1024 * 1024) throw new Error(t("Favoris radio illisibles."));
  const data = JSON.parse(raw) as { version?: number; stations?: unknown[] };
  if (!data || data.version !== 1 || !Array.isArray(data.stations) || data.stations.length > 500)
    throw new Error(t("Favoris radio illisibles."));
  const rows = data.stations.map(station);
  if (new Set(rows.map((r) => r.uuid)).size !== rows.length)
    throw new Error(t("Favoris radio illisibles."));
  return rows;
}
/** Storage is updated before the favourite state; an unreadable store is never reset implicitly. */
export function createRadioFavourites(storage: Store = localStorage) {
  const [stations, setStations] = createSignal<Station[]>([]),
    [error, setError] = createSignal("");
  try {
    setStations(readRadioFavourites(storage));
  } catch (failure) {
    setError(String(failure));
  }
  return {
    stations,
    error,
    has: (uuid: string) => stations().some((row) => row.uuid === uuid),
    toggle: (selected: Station) => {
      try {
        const rows = readRadioFavourites(storage),
          next = rows.some((row) => row.uuid === selected.uuid)
            ? rows.filter((row) => row.uuid !== selected.uuid)
            : [...rows, station(selected)];
        if (next.length > 500)
          throw new Error(t("Vous pouvez enregistrer jusqu’à 500 radios favorites."));
        storage.setItem(key, JSON.stringify({ version: 1, stations: next }));
        setStations(next);
        setError("");
      } catch (failure) {
        setError(String(failure));
      }
    },
  };
}
