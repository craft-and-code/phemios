import { createComputed, createSignal, on, onCleanup, type Accessor } from "solid-js";
import type { Artist } from "./types";
import { biographyTarget } from "./biography-reading";
import { wikipediaArticle, type WikipediaArticle } from "../encyclopedia/wikipedia";
import type { Language } from "../i18n";
/** One explicit attributed-title request; artist replacement/disposal cannot publish stale prose. */
export function createBiographyReading(
  artist: Accessor<Pick<Artist, "reference" | "biographyCredit">>,
  request: (language: Language, title: string) => Promise<unknown>,
  cached?: (language: Language, title: string) => Promise<unknown | null>,
) {
  const [reading, setReading] = createSignal<WikipediaArticle>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let generation = 0;
  const reset = () => {
    generation++;
    setReading(undefined);
    setBusy(false);
    setError("");
  };
  createComputed(on(() => `${artist().reference}\0${artist().biographyCredit?.url ?? ""}`, reset));
  onCleanup(() => {
    generation++;
  });
  const target = () => biographyTarget(artist().biographyCredit?.url);
  return {
    reading,
    busy,
    error,
    target,
    back: reset,
    clearError: () => setError(""),
    async open() {
      const source = target();
      if (!source || busy()) return;
      const ticket = ++generation;
      setBusy(true);
      setError("");
      try {
        const retained = cached ? await cached(source.language, source.title) : null;
        if (ticket !== generation) return;
        if (retained != null) {
          const article = wikipediaArticle(retained);
          if (article.language !== source.language) throw new Error("Réponse Wikipédia invalide.");
          setReading(article);
        }
        const article = wikipediaArticle(await request(source.language, source.title));
        if (article.language !== source.language) throw new Error("Réponse Wikipédia invalide.");
        const current = reading();
        if (
          ticket === generation &&
          (!current ||
            current.language !== article.language ||
            current.pageId !== article.pageId ||
            current.revision !== article.revision ||
            current.title !== article.title ||
            current.text !== article.text ||
            current.retrievedAt !== article.retrievedAt)
        )
          setReading(article);
      } catch (failure) {
        if (ticket === generation) setError(String(failure));
      } finally {
        if (ticket === generation) setBusy(false);
      }
    },
  };
}
