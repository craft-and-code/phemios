import { t } from "../i18n";
export type Section =
  | "concerts"
  | "encyclopedia"
  | "achievements"
  | "artists"
  | "albums"
  | "tracks"
  | "recent"
  | "compilations"
  | "countries"
  | "genres"
  | "labels"
  | "moods"
  | "playback"
  | "rated"
  | "tags"
  | "favourites"
  | "collections"
  | "history"
  | "playlists"
  | "podcasts"
  | "radio"
  | "doctor"
  | "analysis"
  | "relations"
  | "players"
  | "statistics"
  | "settings"
  | "advanced-search";
export type Route =
  | { kind: "section"; section: Section }
  | { kind: "artist" | "album" | "track" | "label"; reference: string }
  | { kind: "not-found" };

export const sections: readonly { id: Section; label: string; symbol: string }[] = [
  { id: "artists", label: t("Artistes"), symbol: "users" },
  { id: "albums", label: t("Albums"), symbol: "disc" },
  { id: "tracks", label: t("Pistes"), symbol: "list" },
  { id: "recent", label: t("Nouveautés"), symbol: "sparkles" },
  { id: "compilations", label: t("Compilations"), symbol: "layers" },
  { id: "countries", label: t("Pays"), symbol: "globe" },
  { id: "genres", label: t("Genres"), symbol: "genres" },
  { id: "labels", label: t("Labels"), symbol: "label" },
  { id: "moods", label: t("Ambiances"), symbol: "moods" },
  { id: "favourites", label: t("Favoris"), symbol: "heart" },
  { id: "rated", label: t("Albums notés"), symbol: "star" },
  { id: "tags", label: t("Tags"), symbol: "tags" },
  { id: "collections", label: t("Collections"), symbol: "library" },
  { id: "history", label: t("Historique"), symbol: "history" },
  { id: "playlists", label: t("Exports M3U"), symbol: "playlist" },
  { id: "radio", label: t("Radio"), symbol: "radio" },
  { id: "podcasts", label: t("Podcasts"), symbol: "podcast" },
  { id: "concerts", label: t("Concerts"), symbol: "concerts" },
  { id: "relations", label: t("Relations"), symbol: "graph" },
  { id: "encyclopedia", label: t("Encyclopédie"), symbol: "book" },
  { id: "achievements", label: t("Trophées"), symbol: "trophy" },
  { id: "doctor", label: "Doctor", symbol: "doctor" },
  { id: "analysis", label: t("Analyses"), symbol: "wave" },
  { id: "statistics", label: t("Statistiques"), symbol: "stats" },
  { id: "players", label: t("Lecteurs externes"), symbol: "drive" },
];

/** Hash navigation works in native packaged assets without server rewrites. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return { kind: "section", section: "artists" };
  if (path === "playback") return { kind: "section", section: "playback" };
  if (path === "advanced-search") return { kind: "section", section: "advanced-search" };
  if (path === "settings") return { kind: "section", section: "settings" };
  const section = sections.find((candidate) => candidate.id === path);
  if (section) return { kind: "section", section: section.id };
  const match = /^(artist|album|track|label)\/([^/]+)$/.exec(path);
  if (match?.[1] && match[2]) {
    try {
      return {
        kind: match[1] as "artist" | "album" | "track" | "label",
        reference: decodeURIComponent(match[2]),
      };
    } catch {
      return { kind: "not-found" };
    }
  }
  return { kind: "not-found" };
}

/** Result states use the same semantic glyph as their navigation section. */
export function sectionIcon(section: Section): string {
  return sections.find((item) => item.id === section)?.symbol ?? "disc";
}
