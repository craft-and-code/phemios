import type { Album } from "./types";
import type { Annotation } from "./server";
/** Favourite artists contribute owned principal discography, not every supporting credit. */
export function favouriteAlbums(
  albums: readonly Album[],
  annotations: Readonly<Record<string, Annotation | undefined>>,
): Album[] {
  return albums.filter(
    (album) =>
      annotations[album.reference]?.loved ||
      (album.artist !== null && annotations[album.artist]?.loved),
  );
}
