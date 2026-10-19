import { t } from "../i18n";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
type Request = (
  path: string,
  query: Record<string, string>,
  method: string,
  body: unknown,
  source: SourceId,
  owner?: AccountSession,
) => Promise<unknown>;
/** One explicit advanced-search page and its optional first-page achievement. */
export async function readAdvancedTrackPage(
  request: Request,
  source: SourceId,
  expression: string,
  at: number,
  session: () => AccountSession | undefined,
  current: () => boolean,
) {
  const identity = session();
  const admit = () => {
    if (!identity || !current() || session() !== identity) throw new Error(t("Chargement annulé."));
  };
  admit();
  const status = (await request("/api/v1/status", {}, "GET", null, source, identity)) as {
    capabilities: string[];
  };
  admit();
  if (!status.capabilities?.includes("advanced_search"))
    throw new Error(t("Mettez à jour puis redémarrez Aède pour la recherche avancée."));
  const answer = await request(
    "/api/me/v1/search",
    { expression, offset: String(at), limit: "50" },
    "GET",
    null,
    source,
    identity,
  );
  admit();
  if (
    at === 0 &&
    status.capabilities.includes("private_achievements") &&
    identity &&
    identity.account.role !== "auditor"
  ) {
    await request(
      "/api/me/v1/achievements",
      {},
      "POST",
      { advanced_search: true },
      source,
      identity,
    ).catch(() => undefined);
  }
  admit();
  return answer;
}
