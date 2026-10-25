import { createDiagnosticRead } from "./diagnostic-read";
import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import type { Album } from "./types";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
export interface CollectionAlbumScope {
  name: string;
  id?: string | undefined;
  session: AccountSession;
  source: SourceId;
  albums: readonly Album[];
}
/** Resolve only references admitted by the captured catalog; never substitute the whole library. */
export function createCollectionAlbums(
  scope: () => CollectionAlbumScope | false,
  request: typeof requestAede = requestAede,
) {
  return createDiagnosticRead(scope, async (key) => {
    const response = await request<{ items: unknown }>(
      "/api/me/v1/collection/albums",
      key.id ? { id: key.id } : { name: key.name },
      "GET",
      null,
      key.source,
      key.session,
    );
    if (!Array.isArray(response.items) || response.items.some((r) => typeof r !== "string"))
      throw new Error(t("Collection Aède invalide."));
    const refs = new Set<string>(response.items),
      albums = key.albums.filter((a) => refs.has(a.reference));
    if (albums.length !== refs.size)
      throw new Error(t("La collection a changé : resynchronisez la bibliothèque."));
    return albums;
  });
}
