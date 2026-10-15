import type { Album } from "./types";
/** Unknown/future timestamps never imply a recent catalog addition. */
export function isRecentAlbum(album: Album, nowSeconds: number): boolean {
  return (
    album.addedAt != null &&
    Number.isFinite(album.addedAt) &&
    album.addedAt <= nowSeconds &&
    album.addedAt >= nowSeconds - 30 * 86400
  );
}
/** Rolling thirty days use observed catalog entry timestamps, never release years or file mtimes. */
export function recentAlbums(albums: readonly Album[], nowSeconds: number) {
  return albums
    .filter((album) => isRecentAlbum(album, nowSeconds))
    .sort((a, b) => b.addedAt! - a.addedAt! || a.reference.localeCompare(b.reference));
}
