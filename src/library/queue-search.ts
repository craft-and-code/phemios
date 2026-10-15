import { matchesQueueMetadata } from "./queue-search-text";
import { t } from "../i18n";
import type { Album, Artist } from "./types";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { catalogOrigins, referenceSource } from "./sources";
import { normalizeName } from "./filtering";
import { parseTrackPage } from "./track-page";
import { parseM3UPage } from "./m3u-files";
export const queueCategoryLabels = {
  all: "Tous",
  tracks: "Pistes",
  albums: "Albums",
  artists: "Artistes",
  m3u: "M3U",
  collections: "Collections",
} as const;
export type QueueCategory = keyof typeof queueCategoryLabels;
export interface QueueSearchItem {
  key: string;
  category?: Exclude<QueueCategory, "all">;
  title: string;
  detail: string;
  source: SourceId;
  reference?: string;
  album?: string;
  collection?: string;
  playlist?: { id: string; kind: "files" | "exports" };
}
export interface QueueSearchScope {
  category: QueueCategory;
  query: string;
  offset: number;
  owners: readonly { source: SourceId; session: AccountSession }[];
  albums: readonly Album[];
  artists: readonly Artist[];
}
type Request = (
  path: string,
  query: Record<string, string>,
  source: SourceId,
  owner: AccountSession,
) => Promise<unknown>;
/** One bounded page retains usable results when another source is unavailable. */
export interface QueueSearchPage {
  items: QueueSearchItem[];
  more: boolean;
  errors: string[];
}
/** Bounded explicit search uses public cached metadata and exact current-owner remote pages. */
export async function searchQueue(
  scope: QueueSearchScope,
  request: Request,
  current: () => boolean,
): Promise<QueueSearchPage> {
  if (scope.category === "all") {
    const categories: Exclude<QueueCategory, "all">[] = [
      "tracks",
      "albums",
      "artists",
      "m3u",
      "collections",
    ];
    const pages = await Promise.all(
      categories.map(async (category) => {
        const page = await searchQueue({ ...scope, category }, request, current);
        return { ...page, items: page.items.map((row) => ({ ...row, category })) };
      }),
    );
    if (!current()) return { items: [], more: false, errors: [] };
    const term = normalizeName(scope.query);
    return {
      items: pages
        .flatMap((page) => page.items)
        .sort(
          (a, b) =>
            Number(normalizeName(b.title) === term) - Number(normalizeName(a.title) === term),
        ),
      more: pages.some((page) => page.more),
      errors: [...new Set(pages.flatMap((page) => page.errors))],
    };
  }
  const query = normalizeName(scope.query),
    matches = (text: string) => normalizeName(text).includes(query);
  const artistNames = new Map(
    scope.category === "albums" ? scope.artists.map((a) => [a.reference, a.name]) : [],
  );
  const principalArtists = new Set(
    scope.category === "artists" ? scope.albums.map((album) => album.artist) : [],
  );
  const items: QueueSearchItem[] = [],
    errors: string[] = [];
  let more = false;
  // Public cached catalogue visibility is independent of permission to append or read private lists.
  const sources = ["albums", "artists"].includes(scope.category)
    ? catalogOrigins(scope.albums.map((album) => album.reference)).map((source) => ({
        source,
        session: scope.owners.find((owner) => owner.source === source)?.session,
      }))
    : scope.owners;
  for (const { source, session } of sources) {
    if (!current()) return { items: [], more: false, errors: [] };
    const failed = (error: unknown) => {
      if (current())
        errors.push(
          `${source === "local" ? t("Local") : t("Serveur")} · ${error instanceof Error ? error.message : String(error)}`,
        );
    };
    try {
      if (scope.category === "albums" || scope.category === "artists") {
        const rows =
          scope.category === "albums"
            ? scope.albums
                .filter(
                  (a) =>
                    referenceSource(a.reference) === source &&
                    (matches([a.title, artistNames.get(a.artist ?? ""), a.year].join(" ")) ||
                      matchesQueueMetadata(a.searchFields ?? [], scope.query)),
                )
                .map((a) => ({
                  key: a.reference,
                  reference: a.reference,
                  album: a.reference,
                  title: a.title,
                  detail: [artistNames.get(a.artist ?? "") ?? t("Artistes divers"), a.year]
                    .filter(Boolean)
                    .join(" · "),
                  source,
                }))
            : scope.artists
                .filter(
                  (a) =>
                    referenceSource(a.reference) === source &&
                    (matches(a.name) || matchesQueueMetadata(a.searchFields ?? [], scope.query)) &&
                    principalArtists.has(a.reference),
                )
                .map((a) => ({
                  key: a.reference,
                  reference: a.reference,
                  title: a.name,
                  detail: t("Discographie"),
                  source,
                }));
        rows.sort((a, b) => a.title.localeCompare(b.title));
        more ||= rows.length > scope.offset + 50;
        items.push(...rows.slice(scope.offset, scope.offset + 50));
      } else if (!session) {
        continue;
      } else if (scope.category === "tracks") {
        const page = parseTrackPage(
          await request(
            "/api/v1/presentation/tracks",
            {
              offset: String(scope.offset),
              limit: "50",
              ...(scope.query.trim() ? { q: scope.query.trim() } : {}),
            },
            source,
            session,
          ),
          scope.offset,
        );
        more ||= page.total > scope.offset + 50;
        items.push(
          ...page.items.map((row) => ({
            key: row.reference,
            reference: row.reference,
            title: row.title,
            detail: row.album_title ?? t("Sans album"),
            source,
            ...(row.release ? { album: row.release } : {}),
          })),
        );
      } else if (scope.category === "m3u") {
        for (const kind of ["files", "exports"] as const) {
          if (!current()) break;
          try {
            const path = kind === "files" ? "/api/me/v1/m3u-files" : "/api/me/v1/m3u";
            const page = parseM3UPage(
              await request(
                path,
                {
                  offset: String(scope.offset),
                  limit: "50",
                  ...(scope.query.trim() ? { q: scope.query.trim() } : {}),
                },
                source,
                session,
              ),
              scope.offset,
              kind,
            );
            more ||= page.total > scope.offset + 50;
            items.push(
              ...page.items.map((row) => ({
                key: `${source}:${row.id}`,
                title: row.name,
                detail: kind === "files" ? t("Fichier de la bibliothèque") : t("Export enregistré"),
                source,
                playlist: { id: row.id, kind },
              })),
            );
          } catch (error) {
            failed(error);
          }
        }
      } else {
        const rows: QueueSearchItem[] = [];
        let total = 1;
        for (let offset = 0; offset < total; offset += 50) {
          if (!current()) break;
          const page = (await request(
            "/api/me/v1/collections",
            { offset: String(offset), limit: "50" },
            source,
            session,
          )) as {
            items?: { name?: unknown; expression?: unknown }[];
            total?: unknown;
            offset?: unknown;
          };
          if (
            !page ||
            !Array.isArray(page.items) ||
            !Number.isSafeInteger(page.total) ||
            Number(page.total) > 2048 ||
            Number(page.total) < offset + page.items.length ||
            page.offset !== offset ||
            page.items.length !== Math.min(50, Number(page.total) - offset)
          )
            throw Error(t("Page Aède invalide."));
          total = Number(page.total);
          for (const row of page.items) {
            if (typeof row.name !== "string" || typeof row.expression !== "string")
              throw Error(t("Collection Aède invalide."));
            if (matches(row.name))
              rows.push({
                key: `${source}:collection:${row.name}`,
                title: row.name,
                detail: t("Collection"),
                source,
                collection: row.name,
              });
          }
        }
        more ||= rows.length > scope.offset + 50;
        items.push(...rows.slice(scope.offset, scope.offset + 50));
      }
    } catch (error) {
      failed(error);
    }
  }
  return current() ? { items, more, errors } : { items: [], more: false, errors: [] };
}
