import type { Artist } from "./types";
export interface Neighbour {
  artist: Artist;
  weight: number;
  kind: string;
  source: string;
}
/** Keep catalog-proven neighbours, deduplicate and bound SVG work independently of library size. */
export function neighbours(artists: readonly Artist[], selected: Artist, limit = 16): Neighbour[] {
  const byId = new Map(artists.map((artist) => [artist.reference, artist]));
  const unique = new Map<string, Neighbour>();
  for (const edge of selected.relations ?? []) {
    const artist = byId.get(edge.reference);
    if (!artist || artist.reference === selected.reference) continue;
    const held = unique.get(artist.reference);
    if (!held || edge.weight > held.weight)
      unique.set(artist.reference, {
        artist,
        weight: edge.weight,
        kind: edge.kind,
        source: edge.source,
      });
  }
  return [...unique.values()]
    .sort((a, b) => b.weight - a.weight || a.artist.name.localeCompare(b.artist.name, "fr"))
    .slice(0, Math.max(0, Math.min(32, Math.floor(limit))));
}
