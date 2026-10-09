import { t } from "../i18n";
import { parseTrackPage, type CatalogTrack } from "./track-page";
import type { SourceId } from "./sources";
export interface TrackSource {
  source: SourceId;
  identity: string;
  scannedAt?: number;
}
/** Stable source order and bounded windows keep both catalogs navigable without downloading all tracks. */
export function combinedTrackReader(
  sources: readonly TrackSource[],
  read: (source: SourceId, offset: number) => Promise<unknown>,
) {
  const cache = new Map<string, Promise<ReturnType<typeof parseTrackPage>>>();
  const epochs = new Map<SourceId, number>();
  function page(source: TrackSource, offset: number) {
    const key = `${source.source}:${offset}`;
    const held = cache.get(key);
    if (held) return held;
    const pending = read(source.source, offset)
      .then((raw) => {
        const parsed = parseTrackPage(raw, offset);
        const expected = epochs.get(source.source) ?? source.scannedAt;
        if (expected !== undefined && expected !== parsed.scannedAt)
          throw new Error(t("Le catalogue a changé ; resynchronisez la bibliothèque."));
        epochs.set(source.source, parsed.scannedAt);
        return parsed;
      })
      .catch((error: unknown) => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, pending);
    return pending;
  }
  return async (offset: number) => {
    const probes = await Promise.allSettled(sources.map((source) => page(source, 0)));
    const items: CatalogTrack[] = [],
      unavailable: { source: SourceId; error: string }[] = [];
    let total = 0;
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]!,
        probe = probes[i]!;
      if (probe.status === "rejected") {
        unavailable.push({ source: source.source, error: String(probe.reason) });
        continue;
      }
      const count = probe.value.total,
        start = Math.max(0, offset - total),
        end = Math.min(count, offset + 50 - total);
      total += count;
      if (!Number.isSafeInteger(total)) throw new Error(t("Nombre de pistes invalide."));
      if (start >= end) continue;
      for (let at = Math.floor(start / 50) * 50; at < end; at += 50) {
        const window = await page(source, at);
        if (window.total !== count)
          throw new Error(t("Le catalogue a changé ; resynchronisez la bibliothèque."));
        items.push(...window.items.slice(Math.max(0, start - at), Math.min(50, end - at)));
      }
    }
    return { items, total, unavailable };
  };
}
