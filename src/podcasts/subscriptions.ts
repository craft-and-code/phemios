import { createSignal } from "solid-js";
import { t } from "../i18n";
import { validatedPodcast, type Podcast } from "./feed";
type Store = Pick<Storage, "getItem" | "setItem">;
const key = "phemios.podcasts.v1";
/** Subscription metadata is local/offline, independent of Aède accounts; no audio file is cached here. */
export function readSubscriptions(storage: Store): Podcast[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > 4 * 1024 * 1024) throw new Error(t("Abonnements podcasts illisibles."));
  const data = JSON.parse(raw) as { version?: number; feeds?: unknown[] };
  if (!data || data.version !== 1 || !Array.isArray(data.feeds) || data.feeds.length > 100)
    throw new Error(t("Abonnements podcasts illisibles."));
  const feeds = data.feeds.map(validatedPodcast);
  if (new Set(feeds.map((f) => f.url)).size !== feeds.length)
    throw new Error(t("Abonnements podcasts illisibles."));
  return feeds;
}
/** Publish UI changes only after persistence succeeds; a corrupt store is never overwritten implicitly. */
export function createSubscriptions(storage: Store = localStorage) {
  const [feeds, setFeeds] = createSignal<Podcast[]>([]),
    [error, setError] = createSignal("");
  try {
    setFeeds(readSubscriptions(storage));
  } catch (e) {
    setError(String(e));
  }
  function write(change: (feeds: Podcast[]) => Podcast[]): boolean {
    try {
      const next = change(readSubscriptions(storage));
      const raw = JSON.stringify({ version: 1, feeds: next });
      if (next.length > 100 || raw.length > 4 * 1024 * 1024)
        throw new Error(t("Limite de stockage des podcasts atteinte."));
      storage.setItem(key, raw);
      setFeeds(next);
      setError("");
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    }
  }
  return {
    feeds,
    error,
    save: (feed: Podcast) =>
      write((rows) => {
        const valid = validatedPodcast(feed),
          index = rows.findIndex((f) => f.url === valid.url);
        if (index < 0) return [...rows, valid];
        return rows.map((f, i) => (i === index ? valid : f));
      }),
    remove: (url: string) => write((rows) => rows.filter((f) => f.url !== url)),
  };
}
