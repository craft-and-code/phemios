import { t } from "../i18n";
export interface Episode {
  id: string;
  title: string;
  url: string;
  date: string | null;
  duration: number | null;
  summary: string;
}
export interface Podcast {
  url: string;
  title: string;
  author: string;
  episodes: Episode[];
}
/** Public media addresses only: no local files, embedded credentials or private literal hosts. */
export function podcastUrl(value: string, base?: string): string {
  const url = new URL(value, base),
    host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.href.length > 2048 ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.includes(":") ||
    /^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)
  )
    throw new Error(t("Adresse podcast invalide."));
  return url.href;
}
/** Podcast clocks may be seconds, MM:SS or HH:MM:SS; missing/invalid durations remain unknown. */
export function podcastDuration(value: string): number | null {
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(value.trim())) return null;
  const parts = value.trim().split(":").map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  const seconds = parts.reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}
function children(element: Element, name: string) {
  return Array.from(element.children).filter((row) => row.localName === name);
}
function text(element: Element, name: string, max = 512) {
  return (children(element, name)[0]?.textContent ?? "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, max);
}
/** Browser-native XML parsing never inserts provider HTML into the application or evaluates DTDs. */
export function parsePodcastFeed(xml: string, url: string): Podcast {
  if (xml.length > 8 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error(t("Flux RSS invalide."));
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error(t("Flux RSS invalide."));
  const root = doc.documentElement,
    atom = root.localName === "feed",
    channel = atom ? root : children(root, "channel")[0];
  if (!channel || (!atom && root.localName !== "rss"))
    throw new Error(t("Ce document n’est pas un flux RSS ou Atom."));
  const title = text(channel, "title");
  if (!title) throw new Error(t("Le podcast n’a pas de titre."));
  const episodes: Episode[] = [],
    seen = new Set<string>();
  for (const row of children(channel, atom ? "entry" : "item")) {
    const enclosure = atom
      ? children(row, "link").find((link) => link.getAttribute("rel") === "enclosure")
      : children(row, "enclosure")[0];
    const raw = enclosure?.getAttribute(atom ? "href" : "url"),
      type = enclosure?.getAttribute("type") ?? "";
    if (!raw || (type && !type.startsWith("audio/"))) continue;
    let source: string;
    try {
      source = podcastUrl(raw, url);
    } catch {
      continue;
    }
    const id = text(row, atom ? "id" : "guid", 1024) || source;
    if (seen.has(id)) continue;
    seen.add(id);
    const date = text(row, atom ? "published" : "pubDate") || text(row, "updated");
    episodes.push({
      id,
      title: text(row, "title") || t("Épisode sans titre"),
      url: source,
      date: Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : null,
      duration: podcastDuration(text(row, "duration")),
      summary: text(row, atom ? "summary" : "description", 4096),
    });
  }
  episodes.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  return {
    url: podcastUrl(url),
    title,
    author: text(channel, "author") || text(channel, "managingEditor"),
    episodes: episodes.slice(0, 200),
  };
}
/** Validate retained subscriptions as strictly as fetched metadata, preserving unreadable stores. */
export function validatedPodcast(value: unknown): Podcast {
  const row = value as Podcast;
  if (
    !row ||
    typeof row.url !== "string" ||
    typeof row.title !== "string" ||
    !row.title.trim() ||
    row.title.length > 512 ||
    typeof row.author !== "string" ||
    row.author.length > 512 ||
    !Array.isArray(row.episodes) ||
    row.episodes.length > 200
  )
    throw new Error(t("Abonnements podcasts illisibles."));
  const url = podcastUrl(row.url),
    episodes = row.episodes.map((e) => {
      if (
        !e ||
        typeof e.id !== "string" ||
        !e.id ||
        e.id.length > 2048 ||
        typeof e.title !== "string" ||
        !e.title ||
        e.title.length > 512 ||
        typeof e.url !== "string" ||
        typeof e.summary !== "string" ||
        e.summary.length > 4096 ||
        (e.date !== null && (typeof e.date !== "string" || !Number.isFinite(Date.parse(e.date)))) ||
        (e.duration !== null &&
          (!Number.isFinite(e.duration) || e.duration <= 0 || e.duration > 86400))
      )
        throw new Error(t("Abonnements podcasts illisibles."));
      return { ...e, url: podcastUrl(e.url) };
    });
  if (new Set(episodes.map((e) => e.id)).size !== episodes.length)
    throw new Error(t("Abonnements podcasts illisibles."));
  return { url, title: row.title, author: row.author, episodes };
}
