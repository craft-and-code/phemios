import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { parseTrackPage } from "./track-page";
import { referenceSource, type SourceId } from "./sources";
import type { AccountSession } from "./server";
import type { Album } from "./types";
/** Resolve the latest private rule into exact matching tracks, without expanding matching releases. */
export async function readCollectionPlayback(
  name: string,
  source: SourceId,
  session: AccountSession,
  albums: readonly Album[],
  scannedAt: number | undefined,
  current: () => boolean,
) {
  if (!current()) return;
  const rule = await requestAede<{ name: unknown; expression: unknown }>(
    "/api/me/v1/collection",
    { name },
    "GET",
    null,
    source,
    session,
  );
  if (!current()) return;
  if (
    !rule ||
    typeof rule !== "object" ||
    rule.name !== name ||
    typeof rule.expression !== "string" ||
    !rule.expression ||
    rule.expression.length > 8192
  )
    throw new Error(t("Collection Aède invalide."));
  const releases = new Map(
    albums.filter((a) => referenceSource(a.reference) === source).map((a) => [a.reference, a]),
  );
  const items: {
    reference: string;
    title: string;
    release: string | null;
    number: number;
    album_total: number;
  }[] = [];
  const seen = new Set<string>();
  let count: number | undefined,
    epoch = scannedAt;
  for (let offset = 0; count === undefined || offset < count; offset += 50) {
    if (!current()) return;
    const response = await requestAede(
      "/api/me/v1/search",
      { expression: rule.expression, offset: String(offset), limit: "50" },
      "GET",
      null,
      source,
      session,
    );
    if (!current()) return;
    const page = parseTrackPage(response, offset);
    if (page.total < 1 || page.total > 4096)
      throw new Error(t("Sélection vide ou supérieure à 4096 pistes."));
    if (
      (count !== undefined && count !== page.total) ||
      (epoch !== undefined && epoch !== page.scannedAt)
    )
      throw new Error(t("Le catalogue a changé ; resynchronisez la bibliothèque."));
    count = page.total;
    epoch = page.scannedAt;
    for (const row of page.items) {
      const album = row.release === null ? undefined : releases.get(row.release);
      const number = row.release === null ? 1 : row.album_position,
        total = row.release === null ? 1 : album?.trackCount;
      if (
        seen.has(row.reference) ||
        referenceSource(row.reference) !== source ||
        !Number.isSafeInteger(number) ||
        !Number.isSafeInteger(total) ||
        !number ||
        !total ||
        number > total
      )
        throw new Error(t("Sélection modifiée ; resynchronisez la bibliothèque."));
      seen.add(row.reference);
      items.push({
        reference: row.reference,
        title: row.title,
        release: row.release,
        number,
        album_total: total,
      });
    }
  }
  return { items };
}
