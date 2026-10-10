import type { Language } from "../i18n";
import { t } from "../i18n";
export interface WikipediaHit {
  pageId: number;
  title: string;
}
export interface WikipediaArticle extends WikipediaHit {
  language: Language;
  revision: number;
  text: string;
  retrievedAt: number;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(t("Réponse Wikipédia invalide."));
  return value as Record<string, unknown>;
}
function positive(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error(t("Réponse Wikipédia invalide."));
  return value;
}
function title(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || /[\p{Cc}]/u.test(value))
    throw new Error(t("Réponse Wikipédia invalide."));
  return value;
}
function language(value: unknown): Language {
  if (value !== "fr" && value !== "en") throw new Error(t("Réponse Wikipédia invalide."));
  return value;
}
/** IPC and retained copies must carry bounded text, positive identities and provenance. */
export function wikipediaArticle(value: unknown): WikipediaArticle {
  const row = object(value);
  if (
    typeof row.text !== "string" ||
    !row.text.trim() ||
    row.text.length > 512 * 1024 ||
    /[\p{Cc}]/u.test(row.text.replace(/[\n\r\t]/g, ""))
  )
    throw new Error(t("Réponse Wikipédia invalide."));
  const retrievedAt = positive(row.retrievedAt);
  if (retrievedAt > 8_640_000_000_000_000) throw new Error(t("Réponse Wikipédia invalide."));
  return {
    language: language(row.language),
    pageId: positive(row.pageId),
    revision: positive(row.revision),
    title: title(row.title),
    text: row.text,
    retrievedAt,
  };
}
/** Titles are plain text, never HTML snippets. Reject mismatched languages and duplicate pages. */
export function wikipediaSearch(value: unknown, expected: Language): WikipediaHit[] {
  const data = object(value);
  if (language(data.language) !== expected || !Array.isArray(data.rows) || data.rows.length > 20)
    throw new Error(t("Réponse Wikipédia invalide."));
  const rows = data.rows.map((item) => {
    const row = object(item);
    return { pageId: positive(row.pageId), title: title(row.title) };
  });
  if (new Set(rows.map((r) => r.pageId)).size !== rows.length)
    throw new Error(t("Réponse Wikipédia invalide."));
  return rows;
}
/** Attribution addresses are constructed from verified identities, never remote URL fields. */
export function wikipediaLinks(row: WikipediaArticle) {
  const base = `https://${row.language}.wikipedia.org/w/index.php`;
  return {
    article: `${base}?curid=${row.pageId}`,
    revision: `${base}?oldid=${row.revision}`,
    authors: `${base}?curid=${row.pageId}&action=history`,
    license: "https://creativecommons.org/licenses/by-sa/4.0/",
  };
}
/** Preserve the API's text; headings are interpreted only as non-executable presentation. */
export function wikipediaBlocks(text: string) {
  const blocks: { heading: boolean; text: string }[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ heading: false, text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const line of text.split(/\r?\n/)) {
    const match = /^(={2,6})\s*(.+?)\s*\1$/u.exec(line.trim());
    if (match?.[2]) {
      flush();
      blocks.push({ heading: true, text: match[2] });
    } else if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush();
  return blocks;
}
