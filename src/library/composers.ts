import type { Filters } from "./types";
import { referenceSource, type SourceId } from "./sources";
import { t } from "../i18n";
/** A collection belongs to one source, and keeps original stable composer identities. */
export function composerExpression(filters: Filters, source: SourceId): string {
  const composers = (filters.composers ?? []).map((reference) => {
    const match = /^artist:(?:@phemios\/(?:local|server)\/)?(.+)$/.exec(reference);
    if (!match || match[1]!.startsWith("@phemios/") || referenceSource(reference) !== source)
      throw new Error(
        t("Sélectionnez les compositeurs d’une seule bibliothèque pour créer une collection."),
      );
    return `artist:${match[1]}`;
  });
  const { recentOnly: _recentOnly, ...criteria } = filters;
  return `browse-v1:${JSON.stringify({ ...criteria, composers, view: "composers" })}`;
}

/** The same primary credited name orders albums, identifies their alphabet landmark and labels the front cover. */
export function composerAlbumNames(
  albums: readonly import("./types").Album[],
  artists: readonly import("./types").Artist[],
  selected: readonly string[] = [],
): ReadonlyMap<string, string> {
  const names = new Map(artists.map((artist) => [artist.reference, artist.name]));
  return new Map(
    albums.map((album) => [
      album.reference,
      (album.composers ?? [])
        .filter((reference) => !selected.length || selected.includes(reference))
        .map((reference) => names.get(reference) ?? reference)
        .sort((a, b) => a.localeCompare(b))[0] ?? "",
    ]),
  );
}
/** The first selected credited name orders editions; titles break ties deterministically. */
export function composerAlbumOrder(
  albums: readonly import("./types").Album[],
  artists: readonly import("./types").Artist[],
  selected: readonly string[] = [],
  reverse = false,
) {
  const keys = composerAlbumNames(albums, artists, selected);
  return [...albums].sort(
    (a, b) =>
      ((keys.get(a.reference) ?? "").localeCompare(keys.get(b.reference) ?? "") ||
        a.title.localeCompare(b.title) ||
        a.reference.localeCompare(b.reference)) * (reverse ? -1 : 1),
  );
}
