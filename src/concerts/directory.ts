import { normalizeName } from "../library/filtering";
import { browseArtists } from "../library/selection";
import type { Artist, Album } from "../library/types";
import { t } from "../i18n";
export interface Concert {
  id: string;
  title: string;
  url: string | null;
  date: string | null;
  time: string | null;
  timezone: string | null;
  status: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  address: string | null;
  info: string | null;
  notice: string | null;
  price: { min: number | null; max: number | null; currency: string | null } | null;
}
export interface ConcertCache {
  artist: string;
  events: Concert[];
  at: number;
  partial: boolean;
}
const key = "phemios.concerts.cache.v1",
  limit = 2 * 1024 * 1024;
type Store = Pick<Storage, "getItem" | "setItem">;
function events(raw: unknown): Concert[] {
  if (!Array.isArray(raw) || raw.length > 1000)
    throw new Error(t("Réponse Ticketmaster invalide."));
  for (const row of raw) {
    if (
      !row ||
      typeof row !== "object" ||
      ["id", "title"].some(
        (field) => typeof row[field] !== "string" || !row[field].trim() || row[field].length > 4096,
      ) ||
      [
        "url",
        "date",
        "time",
        "timezone",
        "status",
        "venue",
        "city",
        "country",
        "countryCode",
        "address",
        "info",
        "notice",
      ].some(
        (field) =>
          row[field] !== null && (typeof row[field] !== "string" || row[field].length > 4096),
      )
    )
      throw new Error(t("Réponse Ticketmaster invalide."));
    if (row.url !== null) {
      const url = new URL(row.url);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error(t("Lien externe invalide."));
    }
    if (row.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(row.date))
      throw new Error(t("Réponse Ticketmaster invalide."));
    if (
      row.price !== null &&
      (!row.price ||
        ["min", "max"].some(
          (field) =>
            row.price[field] !== null &&
            (typeof row.price[field] !== "number" || !Number.isFinite(row.price[field])),
        ) ||
        (row.price.currency !== null && typeof row.price.currency !== "string"))
    )
      throw new Error(t("Réponse Ticketmaster invalide."));
  }
  return raw as Concert[];
}
/** Public event cache contains no key or account data; unreadable stores remain intact. */
export function readConcertCache(storage: Pick<Storage, "getItem">): ConcertCache[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > limit) throw new Error(t("Cache des concerts illisible."));
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 200)
    throw new Error(t("Cache des concerts illisible."));
  const names = new Set<string>();
  for (const row of value.entries) {
    if (
      !row ||
      typeof row.artist !== "string" ||
      !row.artist.trim() ||
      row.artist.length > 200 ||
      names.has(normalizeName(row.artist)) ||
      !Number.isSafeInteger(row.at) ||
      row.at < 0 ||
      typeof row.partial !== "boolean"
    )
      throw new Error(t("Cache des concerts illisible."));
    names.add(normalizeName(row.artist));
    events(row.events);
  }
  return value.entries;
}
/** Retain each completed lookup atomically; only disposable oldest cache entries may expire. */
export function retainConcerts(storage: Store, entry: ConcertCache): ConcertCache[] {
  const rows = [
    entry,
    ...readConcertCache(storage).filter(
      (row) => normalizeName(row.artist) !== normalizeName(entry.artist),
    ),
  ].slice(0, 200);
  while (JSON.stringify({ version: 1, entries: rows }).length > limit && rows.length > 1)
    rows.pop();
  const raw = JSON.stringify({ version: 1, entries: rows });
  readConcertCache({ getItem: () => raw });
  storage.setItem(key, raw);
  return rows;
}
/** Principal album artists only; two connected origins contribute one provider lookup per name. */
export function concertArtists(artists: readonly Artist[], albums: readonly Album[]) {
  const grouped = new Map<string, { name: string; references: string[] }>();
  for (const artist of browseArtists(artists, albums)) {
    const id = normalizeName(artist.name),
      row = grouped.get(id);
    if (row) row.references.push(artist.reference);
    else grouped.set(id, { name: artist.name, references: [artist.reference] });
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}
/** Explicit sequential pagination stops at the provider's 1000-row window and stale-view boundary. */
export async function collectConcerts(
  artist: string,
  current: () => boolean,
  request: (name: string, page: number) => Promise<unknown>,
): Promise<Omit<ConcertCache, "at"> | undefined> {
  const found = new Map<string, Concert>();
  let identity: string | null = null,
    pages = 1;
  for (let page = 0; page < Math.min(10, pages); page++) {
    if (!current()) return;
    const raw = await request(artist, page);
    if (!current()) return;
    const value = raw as {
      page: number;
      pages: number;
      source: string;
      artistId: string | null;
      items: unknown;
    };
    if (
      !value ||
      value.page !== page ||
      value.source !== "Ticketmaster Discovery" ||
      !Number.isSafeInteger(value.pages) ||
      value.pages < 0 ||
      value.pages > 100000 ||
      !(value.artistId === null || typeof value.artistId === "string")
    )
      throw new Error(t("Réponse Ticketmaster invalide."));
    if (identity !== null && value.artistId !== null && identity !== value.artistId)
      throw new Error(
        t("Plusieurs artistes Ticketmaster portent ce nom : correspondance ambiguë."),
      );
    identity = value.artistId ?? identity;
    pages = value.pages;
    for (const row of events(value.items)) found.set(row.id, row);
  }
  return {
    artist,
    partial: pages > 10,
    events: [...found.values()].sort(
      (a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.id.localeCompare(b.id),
    ),
  };
}
