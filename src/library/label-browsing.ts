import type { Album, Artist, Filters, Interval } from "./types";
import { filterAlbums } from "./filtering";
import { initialIndex } from "./filtering";
import type { CountBin } from "./distribution";
import { t } from "../i18n";
/** Label histograms count editions, including compilations with no principal artist. */
export function labelHistogram(
  albums: readonly Album[],
  artists: readonly Artist[],
  filters: Filters,
) {
  const count = (rows: readonly Album[], value: (album: Album) => number | null): CountBin[] => {
    const bins = new Map<number, number>();
    for (const album of rows) {
      const key = value(album);
      if (key !== null) bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    return [...bins].map(([value, count]) => ({ value, count }));
  };
  return {
    years: count(
      filterAlbums(albums, artists, {
        ...filters,
        mode: ["alphabet", "both"].includes(filters.mode) ? "alphabet" : "none",
      }),
      (album) => album.year,
    ),
    alphabet: count(
      filterAlbums(albums, artists, {
        ...filters,
        mode: ["years", "both"].includes(filters.mode) ? "years" : "none",
      }),
      (album) => initialIndex(album.title),
    ),
  };
}
/** The scoped domain never inherits another catalogue view's retained intervals. */
export function labelYearDomain(albums: readonly Album[]): Interval {
  let low = 9999,
    high = 0,
    found = false;
  for (const album of albums)
    if (album.year !== null) {
      found = true;
      low = Math.min(low, album.year);
      high = Math.max(high, album.year);
    }
  return found ? [low, high] : [0, 0];
}
/** Expressions hold original Aède identities; the caller separately captures their source. */
export function labelExpression(reference: string, filters: Filters): string {
  const match = /^label:(?:@phemios\/(?:local|server)\/)?(.+)$/.exec(reference);
  if (!match || match[1]!.startsWith("@phemios/")) throw new Error(t("Label Aède invalide."));
  return `browse-v1:${JSON.stringify({ ...filters, view: "label", label: `label:${match[1]}` })}`;
}
