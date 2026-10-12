import { t } from "../i18n";
import type { M3UFile } from "../components/M3UExport";
import { m3uTitles } from "./m3u-preview";
export type M3UKind = "files" | "exports";
export interface M3URow {
  id: string;
  name: string;
  track_count: number | null;
  path?: string;
}
export interface M3UPageData {
  items: M3URow[];
  total: number;
  unavailable_roots: number;
  unreadable_directories: number;
}
function validId(value: unknown, kind: M3UKind): value is string {
  return (
    typeof value === "string" &&
    (kind === "files" ? /^m3u-file-[a-fA-F0-9]{64}$/ : /^playlist-[a-fA-F0-9]{64}$/).test(value)
  );
}
function text(value: unknown, maximum = 32768): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
/** Metadata-only file rows never invent a track count or resolve untrusted paths. */
export function parseM3UPage(raw: unknown, offset: number, kind: M3UKind): M3UPageData {
  const page = raw as Record<string, unknown>;
  if (
    !page ||
    !Array.isArray(page.items) ||
    page.items.length > 50 ||
    !count(page.total) ||
    page.offset !== offset ||
    (page.items.length > 0 && page.total < offset + page.items.length)
  )
    throw Error(t("Page M3U Aède invalide."));
  const items = page.items.map((value) => {
    const row = value as Record<string, unknown>;
    if (
      !row ||
      !validId(row.id, kind) ||
      !text(row.name, 4096) ||
      !(row.track_count === null || count(row.track_count)) ||
      (kind === "files" && (!text(row.path) || row.track_count !== null))
    )
      throw Error(t("Page M3U Aède invalide."));
    return {
      id: row.id,
      name: row.name,
      track_count: row.track_count as number | null,
      ...(kind === "files" ? { path: row.path as string } : {}),
    };
  });
  if (
    new Set(items.map((row) => row.id)).size !== items.length ||
    (kind === "files" && (!count(page.unavailable_roots) || !count(page.unreadable_directories)))
  )
    throw Error(t("Page M3U Aède invalide."));
  return {
    items,
    total: page.total,
    unavailable_roots: kind === "files" ? Number(page.unavailable_roots) : 0,
    unreadable_directories: kind === "files" ? Number(page.unreadable_directories) : 0,
  };
}
/** A detail must identify exactly the selected file; its text stays inert, including BOM/CRLF. */
export function parseM3UDetail(
  raw: unknown,
  id: string,
  kind: M3UKind,
): M3UFile & { titles: string[]; path?: string } {
  const row = raw as Record<string, unknown>;
  if (
    !row ||
    !validId(id, kind) ||
    row.id !== id ||
    !text(row.name, 4096) ||
    !text(row.filename, 4096) ||
    typeof row.content !== "string" ||
    (kind === "files" && (!text(row.path) || !count(row.track_count)))
  )
    throw Error(t("Contenu M3U invalide."));
  const titles = m3uTitles(row.content, kind === "files");
  if (kind === "files" && titles.length !== row.track_count)
    throw Error(t("Contenu M3U invalide."));
  return {
    id,
    name: row.name,
    filename: row.filename,
    content: row.content,
    titles,
    ...(kind === "files" ? { path: row.path as string } : {}),
  };
}
