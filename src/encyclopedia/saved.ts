import { createSignal } from "solid-js";
import { t } from "../i18n";
import { wikipediaArticle, type WikipediaArticle } from "./wikipedia";
export type ArticleStorage = Pick<Storage, "getItem" | "setItem">;
/** Exploration accepts a private native collection or an explicitly supplied legacy/test store. */
export interface SavedArticleCollection {
  rows: () => readonly WikipediaArticle[];
  error: () => string;
  save: (value: WikipediaArticle) => boolean | Promise<boolean>;
  remove: (value: WikipediaArticle) => boolean | Promise<boolean>;
}
/** The retained edition must contain this exact revision and text, not only the same page title. */
export function articleRetained(
  row: WikipediaArticle,
  copies: readonly WikipediaArticle[],
): boolean {
  return copies.some(
    (held) =>
      held.language === row.language &&
      held.pageId === row.pageId &&
      held.revision === row.revision &&
      held.text === row.text &&
      JSON.stringify(held.externalLinks) === JSON.stringify(row.externalLinks),
  );
}
const key = "phemios.encyclopedia.v1";
const limit = 3 * 1024 * 1024;
function read(storage: ArticleStorage): WikipediaArticle[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  if (raw.length > limit) throw new Error(t("Articles enregistrés illisibles."));
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.articles) || data.articles.length > 40)
    throw new Error(t("Articles enregistrés illisibles."));
  const rows = data.articles.map(wikipediaArticle) as WikipediaArticle[];
  if (new Set(rows.map((row) => `${row.language}:${row.pageId}`)).size !== rows.length)
    throw new Error(t("Articles enregistrés illisibles."));
  return rows;
}
/** Explicit legacy/test access only: desktop saved articles never adopt this unowned device store. */
export function createSavedArticles(storage: ArticleStorage) {
  const [rows, setRows] = createSignal<WikipediaArticle[]>([]),
    [error, setError] = createSignal("");
  try {
    setRows(read(storage));
  } catch {
    setError(t("Articles enregistrés illisibles."));
  }
  function mutate(update: (held: WikipediaArticle[]) => WikipediaArticle[]) {
    try {
      const next = update(read(storage)),
        raw = JSON.stringify({ version: 1, articles: next });
      if (next.length > 40 || raw.length > limit)
        throw new Error(
          t("Stockage des articles plein. Retirez une copie pour en enregistrer une autre."),
        );
      storage.setItem(key, raw);
      setRows(next);
      setError("");
      return true;
    } catch (failure) {
      setError(String(failure));
      return false;
    }
  }
  return {
    rows,
    error,
    save(value: WikipediaArticle) {
      return mutate((held) => {
        const row = wikipediaArticle(value);
        return [...held.filter((r) => r.language !== row.language || r.pageId !== row.pageId), row];
      });
    },
    remove(row: WikipediaArticle) {
      return mutate((held) =>
        held.filter((r) => r.language !== row.language || r.pageId !== row.pageId),
      );
    },
  };
}
