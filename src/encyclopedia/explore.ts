import { createSignal } from "solid-js";
import { t, type Language } from "../i18n";
import { createSavedArticles, type ArticleStorage } from "./saved";
import {
  wikipediaArticle,
  wikipediaSearch,
  type WikipediaHit,
  type WikipediaArticle,
} from "./wikipedia";
interface WikipediaApi {
  search(language: Language, query: string): Promise<unknown>;
  read(language: Language, pageId: number): Promise<unknown>;
}
/** Requests happen only on explicit actions; generation guards prevent late views/languages replacing results. */
export function createWikipediaExplorer(
  api: WikipediaApi,
  language: () => Language,
  storage: ArticleStorage = localStorage,
) {
  const saved = createSavedArticles(storage);
  const [hits, setHits] = createSignal<WikipediaHit[]>([]),
    [article, setArticle] = createSignal<WikipediaArticle | null>(null),
    [busy, setBusy] = createSignal<"" | "search" | "article">(""),
    [error, setError] = createSignal(""),
    [searched, setSearched] = createSignal(false),
    [notice, setNotice] = createSignal("");
  let generation = 0,
    disposed = false;
  const invalidate = () => {
    generation++;
    setBusy("");
    setError("");
    setNotice("");
  };
  async function search(query: string) {
    if (disposed || busy()) return;
    const term = query.trim();
    if (!term || [...term].length > 200 || /\p{Cc}/u.test(term)) {
      setError(t("Saisissez une recherche de 1 à 200 caractères."));
      return;
    }
    invalidate();
    const ticket = generation,
      lang = language();
    setArticle(null);
    setHits([]);
    setSearched(false);
    setBusy("search");
    try {
      const rows = wikipediaSearch(await api.search(lang, term), lang);
      if (!disposed && ticket === generation && language() === lang) {
        setHits(rows);
        setSearched(true);
      }
    } catch (failure) {
      if (!disposed && ticket === generation) setError(String(failure));
    } finally {
      if (!disposed && ticket === generation) setBusy("");
    }
  }
  async function open(hit: WikipediaHit, refresh = false) {
    if (disposed || busy()) return;
    const lang = language(),
      held = saved.rows().find((row) => row.language === lang && row.pageId === hit.pageId);
    invalidate();
    if (held && !refresh) {
      setArticle(held);
      return;
    }
    const ticket = generation;
    setBusy("article");
    try {
      const row = wikipediaArticle(await api.read(lang, hit.pageId));
      if (row.language !== lang || row.pageId !== hit.pageId)
        throw new Error(t("Réponse Wikipédia invalide."));
      if (!disposed && ticket === generation && language() === lang) setArticle(row);
    } catch (failure) {
      if (!disposed && ticket === generation) setError(String(failure));
    } finally {
      if (!disposed && ticket === generation) setBusy("");
    }
  }
  return {
    saved,
    hits,
    article,
    busy,
    error,
    notice,
    searched,
    search,
    open,
    back() {
      invalidate();
      setArticle(null);
    },
    reset() {
      invalidate();
      setArticle(null);
      setHits([]);
      setSearched(false);
    },
    dispose() {
      disposed = true;
      generation++;
    },
    save() {
      const row = article();
      if (row && saved.save(row))
        setNotice(t("Article disponible hors connexion sur cet appareil."));
    },
    retained() {
      const row = article();
      return (
        !!row &&
        saved
          .rows()
          .some(
            (held) =>
              held.language === row.language &&
              held.pageId === row.pageId &&
              held.revision === row.revision &&
              held.text === row.text,
          )
      );
    },
  };
}
