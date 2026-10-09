import { requestAede } from "../platform/desktop";
/** A legacy API must not receive a newer browsing expression or a cross-session write. */
export async function saveBrowsingCollection(
  name: string,
  expression: string,
  isCurrent: () => boolean,
) {
  const status = await requestAede<unknown>("/api/v1/status");
  const capabilities =
    status && typeof status === "object"
      ? (status as { capabilities?: unknown }).capabilities
      : undefined;
  if (!isCurrent()) return;
  if (!Array.isArray(capabilities) || !capabilities.includes("dynamic_browse_collections"))
    throw new Error(
      "Ce serveur ne prend pas encore en charge les collections depuis les filtres. Mettez à jour puis redémarrez Aède.",
    );
  const criteria = JSON.parse(expression.slice("browse-v1:".length)) as { genres?: unknown };
  if (
    Array.isArray(criteria.genres) &&
    criteria.genres.length &&
    !capabilities.includes("dynamic_browse_genres")
  )
    throw new Error(
      "Ce serveur ne prend pas encore en charge plusieurs genres dans une collection. Mettez à jour puis redémarrez Aède.",
    );
  await requestAede("/api/me/v1/collection", { name }, "PUT", { expression, create_only: true });
}
