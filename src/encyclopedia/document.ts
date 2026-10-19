import { wikipediaArticle, wikipediaLinks, type WikipediaArticle } from "./wikipedia";
/** Portable UTF-8 text preserves the selected edition, full extract and attribution without another request. */
export function wikipediaDocument(value: WikipediaArticle): string {
  const row = wikipediaArticle(value),
    links = wikipediaLinks(row),
    fr = row.language === "fr";
  return [
    `\uFEFFWikipédia · ${row.language.toUpperCase()} · ${row.pageId}`,
    row.title,
    "",
    `${fr ? "Article original" : "Original article"} : ${links.article}`,
    `${fr ? "Auteurs et historique" : "Authors and history"} : ${links.authors}`,
    `${fr ? "Révision" : "Revision"} ${row.revision} : ${links.revision}`,
    `CC BY-SA 4.0 : ${links.license}`,
    `${fr ? "Consulté le" : "Retrieved at"} : ${new Date(row.retrievedAt).toISOString()}`,
    "",
    fr
      ? "Texte extrait par Wikipédia, sans images ni tableaux. Consultez l’original pour ses références et sa mise en page complète."
      : "Text extracted by Wikipedia, without images or tables. Consult the original for references and complete layout.",
    "",
    row.text,
    ...(row.externalLinks?.length
      ? [
          "",
          fr ? "Liens externes" : "External links",
          ...row.externalLinks.map((link) => `${link.label} : ${link.url}`),
        ]
      : []),
    "",
  ].join("\n");
}
