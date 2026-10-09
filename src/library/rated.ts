import type { Album } from "./types";
import type { Annotation } from "./server";
/** A supporting performer rating never changes the principal discography selection. */
export function albumRating(
  album: Album,
  annotations: Readonly<Record<string, Annotation | undefined>>,
): number {
  return Math.max(
    annotations[album.reference]?.rating ?? 0,
    album.artist ? (annotations[album.artist]?.rating ?? 0) : 0,
  );
}
/** Equivalent to favourites: direct album ratings or a rated principal artist, once per edition. */
export function ratedAlbums(
  albums: readonly Album[],
  annotations: Readonly<Record<string, Annotation | undefined>>,
  minimum: number,
): Album[] {
  return albums.filter((album) => albumRating(album, annotations) >= Math.max(1, minimum));
}
