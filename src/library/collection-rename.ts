import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
import type { SourceId } from "./sources";
/** One atomic owner-scoped name edit, never a create/delete sequence or an expression replacement. */
export async function renameSavedCollection(
  name: string,
  next: string,
  source: SourceId,
  isCurrent: () => boolean,
): Promise<boolean> {
  if (!isCurrent()) return false;
  const status = await requestAede<{ capabilities?: string[] }>(
    "/api/v1/status",
    {},
    "GET",
    null,
    source,
  );
  if (!isCurrent()) return false;
  if (!Array.isArray(status?.capabilities) || !status.capabilities.includes("collection_rename"))
    throw new Error(t("Mettez à jour puis redémarrez Aède pour renommer les collections."));
  await requestAede("/api/me/v1/collection", { name }, "PATCH", { name: next.trim() }, source);
  return isCurrent();
}
