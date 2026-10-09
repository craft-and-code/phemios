import { createMemo, createResource, type Accessor } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "./sources";
import type { AccountSession } from "./server";
import type { Album } from "./types";
export interface MissingAlbum {
  artist: string;
  artist_name: string;
  release_group: string;
  title: string;
  year: number | null;
  set_aside: boolean;
  source: string;
  url: string;
}
/** A missing release group is an attributed claim, never an owned release edition. */
export function parseMissing(raw: unknown): MissingAlbum {
  const row = raw as MissingAlbum;
  if (
    !row ||
    !row.artist?.startsWith("artist:") ||
    typeof row.artist_name !== "string" ||
    typeof row.title !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(row.release_group) ||
    !(row.year === null || (Number.isSafeInteger(row.year) && row.year >= 0)) ||
    typeof row.set_aside !== "boolean" ||
    row.source !== "musicbrainz" ||
    row.url !== `https://musicbrainz.org/release-group/${row.release_group}`
  )
    throw new Error(t("Album manquant Aède invalide."));
  return row;
}
/** Presentation-only filter projection; its identity can never be sent to album/playback routes. */
export function missingAlbum(row: MissingAlbum): Album {
  return {
    reference: `missing:${row.artist}:${row.release_group}`,
    artist: row.artist,
    title: row.title,
    year: row.year,
    compilation: false,
    tags: [],
  };
}
/** Read each authenticated source once per catalog/session; private decisions never enter the public cache. */
export function createMissingCatalog(
  local: Accessor<AccountSession | undefined>,
  server: Accessor<AccountSession | undefined>,
  epoch: Accessor<unknown>,
) {
  const scope = createMemo(() => ({ local: local(), server: server(), epoch: epoch() }));
  const [value, { refetch }] = createResource(scope, async (key) => {
    const results = await Promise.all(
      (["local", "server"] as const).map(async (source) => {
        const session = key[source];
        const rows: MissingAlbum[] = [];
        if (!session) return { source, session, rows, error: "", covers: false };
        try {
          const status = await requestAede<{ capabilities: string[] }>(
            "/api/v1/status",
            {},
            "GET",
            undefined,
            source,
          );
          if (!status.capabilities?.includes("missing_studio_albums"))
            throw new Error(
              t("Mettez à jour puis redémarrez Aède pour afficher les albums manquants."),
            );
          let total: number | undefined, stamp: number | undefined;
          do {
            const page = await requestAede<{ items: unknown[]; total: number; scanned_at: number }>(
              "/api/me/v1/missing",
              { offset: String(rows.length), limit: "200", include_set_aside: "true" },
              "GET",
              undefined,
              source,
            );
            if (
              !page ||
              !Array.isArray(page.items) ||
              page.items.length > 200 ||
              !Number.isSafeInteger(page.total) ||
              page.total > 10000 ||
              page.total < rows.length + page.items.length ||
              (total !== undefined && total !== page.total) ||
              (stamp !== undefined && stamp !== page.scanned_at) ||
              (rows.length < page.total && !page.items.length)
            )
              throw new Error(t("Pagination Aède invalide."));
            total = page.total;
            stamp = page.scanned_at;
            for (const raw of page.items) {
              const row = parseMissing(raw);
              if (referenceSource(row.artist) !== source)
                throw new Error(t("Origines incompatibles."));
              rows.push(row);
            }
          } while (rows.length < total);
          if (new Set(rows.map((row) => `${row.artist}:${row.release_group}`)).size !== rows.length)
            throw new Error(t("Pagination Aède invalide."));
          return {
            source,
            session,
            rows,
            error: "",
            covers: status.capabilities.includes("missing_album_covers"),
          };
        } catch (failure) {
          return {
            source,
            session,
            covers: false,
            rows: [],
            error: failure instanceof Error ? failure.message : String(failure),
          };
        }
      }),
    );
    return results;
  });
  const current = () =>
    value()?.filter(
      (row) => row.session && row.session === (row.source === "local" ? local() : server()),
    ) ?? [];
  return {
    supportsCover: (artist: string) =>
      current().some(
        (row) => row.source === referenceSource(artist) && "covers" in row && row.covers,
      ),
    rows: () => current().flatMap((row) => row.rows),
    errors: () => current().flatMap((row) => (row.error ? [row.error] : [])),
    loading: () => value.loading,
    refetch,
    decide: async (row: MissingAlbum, setAside: boolean) => {
      const source = referenceSource(row.artist),
        session = source === "local" ? local() : server();
      if (!session) throw new Error(t("Session invalide."));
      await requestAede(
        "/api/me/v1/missing",
        {},
        "PUT",
        { release_group: row.release_group, set_aside: setAside },
        source,
      );
      if (session !== (source === "local" ? local() : server()))
        throw new Error(t("Session invalide."));
      await refetch();
    },
  };
}
