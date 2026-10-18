import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { readCollectionPlayback } from "./collection-playback";
import type { QueueSearchItem } from "./queue-search";
import type { AccountSession } from "./server";
import type { Album } from "./types";
/** Playback and external transfers resolve the same exact library/collection/M3U selection without starting audio. */
export async function readLibrarySelection(
  row: QueueSearchItem,
  owner: AccountSession,
  albums: readonly Album[],
  scannedAt: number | undefined,
  valid: () => boolean,
): Promise<unknown> {
  if (!valid()) return;
  let value: unknown;
  if (row.collection)
    value = await readCollectionPlayback(
      row.collection,
      row.source,
      owner,
      albums,
      scannedAt,
      valid,
    );
  else if (row.playlist) {
    const status = await requestAede<{ capabilities: string[] }>(
      "/api/v1/status",
      {},
      "GET",
      null,
      row.source,
      owner,
    );
    if (!valid()) return;
    if (!status.capabilities?.includes("m3u_playback_selection"))
      throw Error(t("Mettez à jour puis redémarrez Aède pour ajouter les listes M3U."));
    value = await requestAede(
      `${row.playlist.kind === "files" ? "/api/me/v1/m3u-files" : "/api/me/v1/m3u"}/${row.playlist.id}/playback`,
      {},
      "GET",
      null,
      row.source,
      owner,
    );
  } else
    value = await requestAede(
      "/api/v1/presentation/playback",
      { ref: row.reference! },
      "GET",
      null,
      row.source,
      owner,
    );
  return valid() ? value : undefined;
}
