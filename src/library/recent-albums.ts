import type { Album } from "./types";
/** Rolling thirty days use observed catalog entry timestamps, never release years or file mtimes. */
export function recentAlbums(albums: readonly Album[], nowSeconds: number) {
  return albums
    .filter(
      (a) => a.addedAt != null && a.addedAt <= nowSeconds && a.addedAt >= nowSeconds - 30 * 86400,
    )
    .sort((a, b) => b.addedAt! - a.addedAt! || a.reference.localeCompare(b.reference));
}
