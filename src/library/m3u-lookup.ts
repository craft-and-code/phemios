import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { referenceSource } from "./sources";
import { parseM3UPage } from "./m3u-files";
import type { M3UDownloadFile } from "../components/M3UExport";
/** Metadata-only lookup distinguishes confirmed absence from failed inspection and retires replaced owners. */
export async function lookupAlbumM3U(
  release: string,
  current: () => boolean,
): Promise<M3UDownloadFile | null | undefined> {
  if (!current()) return;
  const source = referenceSource(release);
  const status = await requestAede<{ capabilities?: unknown }>(
    "/api/v1/status",
    {},
    "GET",
    null,
    source,
  );
  if (!current()) return;
  if (!Array.isArray(status?.capabilities) || !status.capabilities.includes("album_m3u_lookup"))
    throw Error(t("Mettez à jour puis redémarrez Aède pour vérifier les M3U des albums."));
  const raw = await requestAede(
    "/api/me/v1/m3u-files",
    { ref: release, limit: "1" },
    "GET",
    null,
    source,
  );
  if (!current()) return;
  if ((raw as { reference?: unknown } | null)?.reference !== release)
    throw Error(t("Page M3U Aède invalide."));
  const page = parseM3UPage(raw, 0, "files");
  if (
    page.total > 1 ||
    page.total !== page.items.length ||
    page.unavailable_roots ||
    page.unreadable_directories
  )
    throw Error(t("Page M3U Aède invalide."));
  const row = page.items[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        filename: row.path!.split("/").at(-1)!,
        source,
        library_files: [row.path!],
      }
    : null;
}
