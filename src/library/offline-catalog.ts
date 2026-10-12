import { t } from "../i18n";
import { normalizeName } from "./filtering";
import type { Snapshot } from "./server";
import type { SourceId } from "./sources";
import type { TrackSource } from "./combined-tracks";
export interface PublicCatalogSource extends TrackSource {
  online: boolean;
  snapshot?: Snapshot;
}
/** Public cached catalogs outlive authenticated sessions; current live authority remains explicit. */
export function publicCatalogSources(
  snapshot: (source: SourceId) => Snapshot | undefined,
  connected: readonly TrackSource[],
): PublicCatalogSource[] {
  return (["local", "server"] as const).flatMap((source) => {
    const saved = snapshot(source),
      live = connected.find((value) => value.source === source);
    const cached =
      saved && (!live || live.identity === `${saved.server}:${saved.accountId}`)
        ? saved
        : undefined;
    if (!cached && !live) return [];
    return [
      {
        source,
        online: !!live,
        identity:
          live?.identity ?? `cache:${cached!.server}:${cached!.accountId}:${cached!.scannedAt}`,
        ...(saved && live && !cached
          ? {}
          : live?.scannedAt === undefined
            ? cached
              ? { scannedAt: cached.scannedAt }
              : {}
            : { scannedAt: live.scannedAt }),
        ...(cached ? { snapshot: cached } : {}),
      },
    ];
  });
}
/** Cached search matches only retained track/album titles, never invented raw-tag or credit facts. */
export function cachedTrackPage(snapshot: Snapshot | undefined, query: string, offset: number) {
  if (!snapshot?.tracks)
    throw new Error(
      t("Les pistes ne sont pas encore enregistrées dans ce cache. Synchronisez la bibliothèque."),
    );
  const normalized = normalizeName(query.trim());
  const rows = normalized
    ? snapshot.tracks.filter((track) =>
        [track.title, track.album_title ?? ""].some((text) =>
          normalizeName(text).includes(normalized),
        ),
      )
    : snapshot.tracks;
  return {
    items: rows.slice(offset, offset + 50),
    total: rows.length,
    offset,
    limit: 50,
    scanned_at: snapshot.scannedAt,
  };
}
/** Sort complete authoritative label associations before taking a bounded presentation page. */
export function cachedLabelPage(
  snapshot: Snapshot | undefined,
  query: string,
  offset: number,
  sort: "name" | "albums",
  descending: boolean,
) {
  if (!snapshot?.labels)
    throw new Error(
      t("Les labels ne sont pas encore enregistrés dans ce cache. Synchronisez la bibliothèque."),
    );
  const normalized = normalizeName(query.trim()),
    rows = snapshot.labels.filter((label) => normalizeName(label.name).includes(normalized));
  const direction = descending ? -1 : 1;
  rows.sort(
    (left, right) =>
      (sort === "albums" ? direction * (left.releaseCount - right.releaseCount) : 0) ||
      (sort === "name" ? direction : 1) *
        normalizeName(left.name).localeCompare(normalizeName(right.name)) ||
      left.reference.localeCompare(right.reference),
  );
  return { items: rows.slice(offset, offset + 50), total: rows.length };
}
