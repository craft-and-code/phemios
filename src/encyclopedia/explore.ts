import { createSignal } from "solid-js";
import { t, type Language } from "../i18n";
import {
  articleRetained,
  createSavedArticles,
  type ArticleStorage,
  type SavedArticleCollection,
} from "./saved";
import {
  wikipediaArticle,
  wikipediaSearch,
  type WikipediaHit,
  type WikipediaArticle,
} from "./wikipedia";
interface WikipediaApi {
  search(language: Language, query: string): Promise<unknown>;
  read(language: Language, pageId: number): Promise<unknown>;
  download?(article: WikipediaArticle): Promise<string>;
  translate?(language: Language, pageId: number, target: Language): Promise<unknown>;
}
/** Requests happen only on explicit actions; generation guards prevent late views/languages replacing results. */
export function createWikipediaExplorer(
  api: WikipediaApi,
  language: () => Language,
  storage: ArticleStorage | SavedArticleCollection,
) {
  const saved: SavedArticleCollection = "rows" in storage ? storage : createSavedArticles(storage);
  const [hits, setHits] = createSignal<WikipediaHit[]>([]),
    [article, setArticle] = createSignal<WikipediaArticle | null>(null),
    [busy, setBusy] = createSignal<"" | "search" | "article" | "download">(""),
    [error, setError] = createSignal(""),
    [searched, setSearched] = createSignal(false),
    [notice, setNotice] = createSignal("");
  const editions = new Map<Language, WikipediaArticle>();
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
    editions.clear();
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
    editions.clear();
    if (held && !refresh) {
      editions.set(lang, held);
      setArticle(held);
      return;
    }
    const ticket = generation;
    setBusy("article");
    try {
      const row = wikipediaArticle(await api.read(lang, hit.pageId));
      if (row.language !== lang || row.pageId !== hit.pageId)
        throw new Error(t("Réponse Wikipédia invalide."));
      if (!disposed && ticket === generation && language() === lang) {
        editions.set(lang, row);
        setArticle(row);
      }
    } catch (failure) {
      if (!disposed && ticket === generation) setError(String(failure));
    } finally {
      if (!disposed && ticket === generation) setBusy("");
    }
  }
  /** An edition change follows the current article's actual language link; failure leaves its text intact. */
  async function changeEdition(query: string): Promise<boolean> {
    if (disposed || busy()) return false;
    const held = article(),
      target = language();
    if (held?.language === target) return true;
    if (!held) {
      const repeatSearch = searched();
      invalidate();
      setHits([]);
      setSearched(false);
      if (repeatSearch) await search(query);
      return !error();
    }
    invalidate();
    setHits([]);
    setSearched(false);
    const cached = editions.get(target);
    if (cached) {
      setArticle(cached);
      return true;
    }
    const ticket = generation;
    setBusy("article");
    try {
      if (!api.translate) throw Error(t("Cette version linguistique n’est pas disponible."));
      const row = wikipediaArticle(await api.translate(held.language, held.pageId, target));
      if (row.language !== target) throw Error(t("Réponse Wikipédia invalide."));
      if (disposed || ticket !== generation || language() !== target) return false;
      editions.set(held.language, held);
      editions.set(target, row);
      setArticle(row);
      return true;
    } catch (failure) {
      if (!disposed && ticket === generation) setError(String(failure));
      return false;
    } finally {
      if (!disposed && ticket === generation) setBusy("");
    }
  }
  /** File export is independent from the explicitly retained reading copy. */
  async function download() {
    const row = article();
    if (disposed || busy() || !row) return false;
    invalidate();
    const ticket = generation;
    setBusy("download");
    try {
      if (!api.download) throw Error(t("Le téléchargement nécessite l’application desktop."));
      const path = await api.download(row);
      if (!disposed && ticket === generation && article() === row) {
        setNotice(t("Article téléchargé : {0}", path));
        return true;
      }
      return false;
    } catch (failure) {
      if (!disposed && ticket === generation && article() === row) setError(String(failure));
      return false;
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
    changeEdition,
    download,
    back() {
      invalidate();
      editions.clear();
      setArticle(null);
    },
    reset() {
      invalidate();
      editions.clear();
      setArticle(null);
      setHits([]);
      setSearched(false);
    },
    dispose() {
      disposed = true;
      generation++;
    },
    save() {
      const row = article(),
        ticket = generation;
      if (disposed || !row) return;
      const completed = (success: boolean) => {
        if (success && !disposed && ticket === generation && article() === row)
          setNotice(t("Article disponible hors connexion sur cet appareil."));
      };
      const result = saved.save(row);
      if (typeof result === "boolean") {
        completed(result);
        return;
      }
      return result.then(completed).catch((failure) => {
        if (!disposed && ticket === generation && article() === row) setError(String(failure));
      });
    },
    retained() {
      const row = article();
      return !!row && articleRetained(row, saved.rows());
    },
  };
}
