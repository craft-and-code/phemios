import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
/** Shared source claims are administrative catalogue data, never personal annotations or tag edits. */
export interface SourceReviewItem {
  id: string;
  revision: string;
  reference: string;
  name: string;
  kind: "artist" | "release" | "track" | "label";
  source_id: string | null;
  url: string | null;
  score: number | null;
  decision: "accepted" | "rejected" | null;
  local_mbid: string | null;
  details: [string, string][];
}
export interface SourceReviewPage {
  items: SourceReviewItem[];
  total: number;
  offset: number;
  limit: number;
}
const invalid = () => new Error(t("Correspondances MusicBrainz illisibles."));
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 4096): string {
  if (typeof value !== "string" || value.length > max) throw invalid();
  return value;
}
function optional(value: unknown): string | null {
  return value === null ? null : text(value);
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}
/** Only canonical MusicBrainz entity links can leave the review; arbitrary service URLs stay inert. */
export function parseSourceReview(value: unknown): SourceReviewItem {
  const row = object(value);
  const kind = text(row.kind) as SourceReviewItem["kind"];
  if (!["artist", "release", "track", "label"].includes(kind)) throw invalid();
  const id = text(row.id),
    revision = text(row.revision),
    reference = text(row.reference);
  if (
    ![id, revision].every((v) => /^[a-f\d]{16}$/i.test(v)) ||
    !reference.startsWith(`${kind}:`) ||
    reference === `${kind}:`
  )
    throw invalid();
  const decision = row.decision as SourceReviewItem["decision"];
  if (decision !== null && decision !== "accepted" && decision !== "rejected") throw invalid();
  const score = row.score === null ? null : integer(row.score);
  if (score !== null && score > 100) throw invalid();
  const source_id = optional(row.source_id),
    url = optional(row.url);
  const namespaces =
    kind === "release" ? ["release", "release-group"] : [kind === "track" ? "recording" : kind];
  if (
    url !== null &&
    (!source_id ||
      !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(source_id) ||
      !namespaces.some((ns) => url === `https://musicbrainz.org/${ns}/${source_id}`))
  )
    throw invalid();
  if (!Array.isArray(row.details) || row.details.length > 10) throw invalid();
  const details = row.details.map((entry): [string, string] => {
    if (!Array.isArray(entry) || entry.length !== 2) throw invalid();
    return [text(entry[0], 64), text(entry[1], 1024)];
  });
  return {
    id,
    revision,
    reference,
    kind,
    name: text(row.name),
    source_id,
    url,
    score,
    decision,
    local_mbid: optional(row.local_mbid),
    details,
  };
}
export function parseSourceReviewPage(value: unknown): SourceReviewPage {
  const row = object(value);
  if (!Array.isArray(row.items) || row.items.length > 100) throw invalid();
  const items = row.items.map(parseSourceReview),
    total = integer(row.total),
    offset = integer(row.offset),
    limit = integer(row.limit);
  if (
    !limit ||
    limit > 100 ||
    items.length > limit ||
    items.length > total ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw invalid();
  return { items, total, offset, limit };
}
export type ReviewDecision = "accept" | "reject" | "undo";
/** Exact optimistic revisions prevent an old card from accepting a refreshed or replaced identity. */
export async function decideSourceReview(
  source: SourceId,
  owner: AccountSession,
  row: SourceReviewItem,
  decision: ReviewDecision,
): Promise<SourceReviewItem> {
  return parseSourceReview(
    await requestAede(
      "/api/admin/v1/source-review",
      {},
      "PATCH",
      { id: row.id, revision: row.revision, decision },
      source,
      owner,
    ),
  );
}

/** Keep review navigation reachable when decisions shrink the pending queue. */
export function hasSourceReviewPages(
  page: Pick<SourceReviewPage, "total" | "offset" | "limit">,
): boolean {
  return page.offset > 0 || page.total > page.limit;
}
