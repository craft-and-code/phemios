import { createMemo, onCleanup } from "solid-js";
import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import { parseAchievements } from "./achievements";
import { createDiagnosticRead } from "./diagnostic-read";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
/** Trophy refresh belongs to the captured account/source, including its retained unlock write. */
export function createAchievementLoading(
  session: () => AccountSession | undefined,
  source: () => SourceId,
) {
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const scope = createMemo(() => {
    const account = session();
    return account ? { session: account, source: source() } : false;
  });
  return createDiagnosticRead(scope, async (key, admission) => {
    const current = () => alive && scope() === key && admission.current();
    const info = await requestAede<{ capabilities: string[] }>(
      "/api/v1/status",
      {},
      "GET",
      null,
      key.source,
    );
    if (!current()) return undefined;
    if (!info.capabilities.includes("private_achievements"))
      throw new Error(t("Mettez à jour puis redémarrez Aède pour les trophées."));
    const raw = await requestAede(
      "/api/me/v1/achievements",
      {},
      key.session.account.role === "auditor" ? "GET" : "POST",
      key.session.account.role === "auditor" ? null : {},
      key.source,
    );
    if (!current()) return undefined;
    return parseAchievements(raw);
  });
}
