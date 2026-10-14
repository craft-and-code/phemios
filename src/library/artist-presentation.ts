import type { Album, Artist } from "./types";
import { createCoverPosition, type CoverPosition } from "../visualizer/cover-position";
/** Only principal releases form the artist carousel, matching chronological discography playback. */
export function artistDiscography(artist: Artist, related: readonly Album[]) {
  return related
    .filter((album) => album.artist === artist.reference)
    .sort(
      (a, b) =>
        (a.year ?? Infinity) - (b.year ?? Infinity) ||
        a.title.localeCompare(b.title) ||
        a.reference.localeCompare(b.reference),
    );
}
/** Session-only positions are pruned when an artist leaves the catalogue; no owner data is persisted. */
export function createArtistPositions(): ArtistPositions {
  const positions = new Map<string, CoverPosition>();
  return {
    forArtist(reference: string) {
      let position = positions.get(reference);
      if (!position) {
        position = createCoverPosition();
        positions.set(reference, position);
      }
      return position;
    },
    retain(references: readonly string[]) {
      const valid = new Set(references);
      for (const reference of positions.keys())
        if (!valid.has(reference)) positions.delete(reference);
    },
  };
}
export interface ArtistPositions {
  forArtist(reference: string): CoverPosition;
  retain(references: readonly string[]): void;
}
