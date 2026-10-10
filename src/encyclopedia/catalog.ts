import articles from "./articles.json";
import type { Language } from "../i18n";
/** Search the bundled original editorial content; never issue external requests on navigation. */
export function encyclopediaRows(query: string, category: string, language: Language) {
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase(language);
  const needle = normalize(query.trim());
  return articles.filter(
    (r) =>
      (!category || r.category === category) &&
      normalize(`${r.title[language]} ${r.body[language]}`).includes(needle),
  );
}
