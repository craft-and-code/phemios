export type Section =
  | "artists"
  | "albums"
  | "compilations"
  | "countries"
  | "genres"
  | "favourites"
  | "collections"
  | "history"
  | "playlists"
  | "analysis"
  | "relations"
  | "players"
  | "statistics";
export type Route =
  | { kind: "section"; section: Section }
  | { kind: "artist" | "album"; reference: string }
  | { kind: "not-found" };

export const sections: readonly { id: Section; label: string; symbol: string }[] = [
  { id: "artists", label: "Artistes", symbol: "users" },
  { id: "albums", label: "Albums", symbol: "disc" },
  { id: "compilations", label: "Compilations", symbol: "layers" },
  { id: "countries", label: "Pays", symbol: "globe" },
  { id: "genres", label: "Genres", symbol: "tags" },
  { id: "favourites", label: "Favoris", symbol: "heart" },
  { id: "collections", label: "Collections", symbol: "library" },
  { id: "history", label: "Historique", symbol: "history" },
  { id: "playlists", label: "Listes M3U", symbol: "list" },
  { id: "analysis", label: "Analyses", symbol: "wave" },
  { id: "relations", label: "Relations", symbol: "graph" },
  { id: "statistics", label: "Statistiques", symbol: "stats" },
  { id: "players", label: "Lecteurs externes", symbol: "drive" },
];

/** Hash navigation works in native packaged assets without server rewrites. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return { kind: "section", section: "artists" };
  const section = sections.find((candidate) => candidate.id === path);
  if (section) return { kind: "section", section: section.id };
  const match = /^(artist|album)\/([^/]+)$/.exec(path);
  if (match?.[1] && match[2]) {
    try {
      return { kind: match[1] as "artist" | "album", reference: decodeURIComponent(match[2]) };
    } catch {
      return { kind: "not-found" };
    }
  }
  return { kind: "not-found" };
}
