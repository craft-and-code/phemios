import { t } from "../i18n";
import { requestAede } from "../platform/desktop";
/** A legacy API must not receive a newer browsing expression or a cross-session write. */
export async function saveBrowsingCollection(
  name: string,
  expression: string,
  isCurrent: () => boolean,
  source?: import("./sources").SourceId,
) {
  const status = source
    ? await requestAede<unknown>("/api/v1/status", {}, "GET", undefined, source)
    : await requestAede<unknown>("/api/v1/status");
  const capabilities =
    status && typeof status === "object"
      ? (status as { capabilities?: unknown }).capabilities
      : undefined;
  if (!isCurrent()) return;
  if (!expression.startsWith("browse-v1:")) {
    if (!Array.isArray(capabilities) || !capabilities.includes("advanced_search"))
      throw new Error(t("Mettez à jour puis redémarrez Aède pour la recherche avancée."));
    if (isCurrent())
      await createSavedCollection(name, expression || "played:>=0", isCurrent, source);
    return;
  }
  if (!Array.isArray(capabilities) || !capabilities.includes("dynamic_browse_collections"))
    throw new Error(
      t(
        "Ce serveur ne prend pas encore en charge les collections depuis les filtres. Mettez à jour puis redémarrez Aède.",
      ),
    );
  const criteria = JSON.parse(expression.slice("browse-v1:".length)) as {
    genres?: unknown;
    view?: string;
  };
  if (criteria.view === "composers" && !capabilities.includes("dynamic_browse_composers"))
    throw new Error(
      t("Mettez à jour puis redémarrez Aède pour conserver les compositeurs dans une collection."),
    );
  if (criteria.view === "tracks" && !capabilities.includes("dynamic_browse_tracks"))
    throw new Error(t("Mettez à jour puis redémarrez Aède pour conserver les filtres de pistes."));
  if (criteria.view === "label" && !capabilities.includes("dynamic_browse_label"))
    throw new Error(
      t("Mettez à jour puis redémarrez Aède pour conserver un label dans une collection."),
    );
  if (criteria.view === "tags" && !capabilities.includes("dynamic_browse_tags"))
    throw new Error(
      t("Mettez à jour puis redémarrez Aède pour conserver les tags dans une collection."),
    );
  if (
    Array.isArray(criteria.genres) &&
    criteria.genres.length &&
    !capabilities.includes("dynamic_browse_genres")
  )
    throw new Error(
      t(
        "Ce serveur ne prend pas encore en charge plusieurs genres dans une collection. Mettez à jour puis redémarrez Aède.",
      ),
    );
  if (
    ["rated", "favourites"].includes(criteria.view ?? "") &&
    !capabilities.includes("dynamic_browse_personal")
  )
    throw new Error(
      t(
        "Mettez à jour puis redémarrez Aède pour conserver les notes et favoris dans une collection.",
      ),
    );
  await createSavedCollection(name, expression, isCurrent, source);
}

/** The caller confirms deletion and captures its owner before invoking this non-replayed mutation. */
export async function deleteSavedCollection(
  name: string,
  source: import("./sources").SourceId,
  isCurrent: () => boolean,
): Promise<boolean> {
  if (!isCurrent()) return false;
  await requestAede("/api/me/v1/collection", { name }, "DELETE", null, source);
  return isCurrent();
}

/** Create a new owner collection; an existing rule must not be replaced implicitly. */
export async function createSavedCollection(
  name: string,
  expression: string,
  isCurrent: () => boolean,
  source?: import("./sources").SourceId,
): Promise<boolean> {
  if (!isCurrent()) return false;
  const body = { expression, create_only: true };
  if (source) await requestAede("/api/me/v1/collection", { name }, "PUT", body, source);
  else await requestAede("/api/me/v1/collection", { name }, "PUT", body);
  return isCurrent();
}
