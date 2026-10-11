import { belongsToArtist } from "./filtering";
import type { Artist, Album } from "./types";
/** Principal discography and credited appearances remain distinct; people without principal editions show their credits first. */
export function artistCatalogue(artist: Artist, albums: readonly Album[]) {
  const principal = albums.filter((album) => album.artist === artist.reference);
  const appearances = albums.filter(
    (album) => album.artist !== artist.reference && belongsToArtist(album, artist),
  );
  return {
    principal,
    appearances,
    featured: principal.length ? principal : appearances,
    credited: !principal.length,
  };
}
