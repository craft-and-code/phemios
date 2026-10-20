import { requestAede } from "../platform/desktop";
import { t } from "../i18n";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
import { parseSourceReviewPage } from "./source-review";
/** Reading stored candidates never initiates an external MusicBrainz request. */
export async function readSourceReviews(
  key: { source: SourceId; owner: AccountSession; query: string; all: boolean; offset: number },
  current: () => boolean,
) {
  const status = await requestAede<{ capabilities?: unknown }>(
    "/api/v1/status",
    {},
    "GET",
    null,
    key.source,
    key.owner,
  );
  if (!current()) return undefined;
  if (!Array.isArray(status?.capabilities) || !status.capabilities.includes("source_review"))
    throw new Error(
      t(
        "Mettez à jour puis redémarrez Aède pour valider les correspondances MusicBrainz dans Phémios.",
      ),
    );
  const biographies = status.capabilities.includes("fetch_artist_summary_links");
  const page = parseSourceReviewPage(
    await requestAede(
      "/api/admin/v1/source-review",
      { q: key.query, all: String(key.all), offset: String(key.offset), limit: "20" },
      "GET",
      null,
      key.source,
      key.owner,
    ),
  );
  if (!current()) return undefined;
  if (page.offset !== key.offset || page.limit !== 20)
    throw new Error(t("Correspondances MusicBrainz illisibles."));
  return { ...page, biographies };
}
