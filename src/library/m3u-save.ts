import { referenceSource } from "./sources";
import { requestAede } from "../platform/desktop";
import type { M3UFile } from "../components/M3UExport";
/** Explicit library publication requires its server capability and the unchanged owner session. */
export async function saveLibraryM3U(
  release: string,
  name: string,
  isCurrent: () => boolean,
): Promise<M3UFile | undefined> {
  const status = await requestAede<{ capabilities?: unknown }>(
    "/api/v1/status",
    {},
    "GET",
    null,
    referenceSource(release),
  );
  if (!isCurrent()) return;
  if (
    !Array.isArray(status?.capabilities) ||
    !status.capabilities.includes("library_m3u_publication")
  )
    throw new Error(
      "Ce serveur ne publie pas encore les M3U dans les dossiers Album et Artiste. Mettez à jour puis redémarrez Aède.",
    );
  const file = await requestAede<M3UFile>("/api/me/v1/m3u", {}, "POST", {
    release,
    name,
    library: true,
  });
  if (!isCurrent()) return;
  if (
    !file ||
    typeof file.id !== "string" ||
    !file.id.startsWith("playlist-") ||
    typeof file.name !== "string" ||
    typeof file.filename !== "string" ||
    typeof file.content !== "string" ||
    !Array.isArray(file.library_files) ||
    file.library_files.length < 1 ||
    file.library_files.length > 2 ||
    !file.library_files.every((path) => typeof path === "string" && path.length > 0)
  )
    throw new Error("Publication M3U non confirmée par Aède.");
  return file;
}
