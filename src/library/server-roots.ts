import { t } from "../i18n";
/** Root reads keep exclusions separate and refuse changing epochs or incomplete pages. */
export async function readServerRoots(
  request: (offset: number) => Promise<unknown>,
): Promise<string[]> {
  const roots: string[] = [];
  let offset = 0,
    total: number | undefined,
    stamp: number | undefined;
  do {
    const page = (await request(offset)) as {
      items?: { path: string | null; status: string }[];
      total?: number;
      offset?: number;
      scanned_at?: number;
    };
    if (
      !page ||
      !Array.isArray(page.items) ||
      !Number.isSafeInteger(page.total) ||
      page.total! < offset + page.items.length ||
      page.total! > 4096 ||
      page.offset !== offset ||
      !Number.isSafeInteger(page.scanned_at) ||
      (total !== undefined && total !== page.total) ||
      (stamp !== undefined && stamp !== page.scanned_at) ||
      (!page.items.length && offset < page.total!)
    )
      throw Error(t("Liste des dossiers serveur invalide ou modifiée."));
    total = page.total;
    stamp = page.scanned_at;
    for (const row of page.items) {
      if (
        !row ||
        !["watched", "excluded", "unwatched"].includes(row.status) ||
        !(row.path === null || typeof row.path === "string")
      )
        throw Error(t("Liste des dossiers serveur invalide ou modifiée."));
      if (row.status === "watched") {
        if (!row.path) throw Error(t("Liste des dossiers serveur invalide ou modifiée."));
        roots.push(row.path);
      }
    }
    offset += page.items.length;
  } while (offset < total!);
  return [...new Set(roots)];
}
