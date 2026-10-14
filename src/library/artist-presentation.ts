import type { Album, Artist } from "./types";
/** Only principal releases form artist previews, matching chronological discography playback. */
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
/** Rank the current owner's known opinions, never adding missing releases or shared ratings. */
export function featuredArtistAlbums(albums: readonly Album[]): Album[] {
  const hasRatings = albums.some((album) => (album.rating ?? 0) > 0);
  const favourites = (a: Album, b: Album) => Number(!!b.favourite) - Number(!!a.favourite);
  const covers = (a: Album, b: Album) => Number(!!b.cover) - Number(!!a.cover);
  return [...albums]
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (hasRatings ? favourites(a, b) || covers(a, b) : covers(a, b) || favourites(a, b)) ||
        (a.year ?? Infinity) - (b.year ?? Infinity) ||
        a.title.localeCompare(b.title) ||
        a.reference.localeCompare(b.reference),
    )
    .slice(0, 2);
}
