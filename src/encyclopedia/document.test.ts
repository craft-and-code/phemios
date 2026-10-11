import { expect, it } from "vitest";
import { wikipediaDocument } from "./document";
import { article } from "./wikipedia.test-fixtures";
it("exports the complete selected edition as readable text with original, revision, authors, date and licence", () => {
  const document = wikipediaDocument(article);
  expect(document).toContain(article.text);
  expect(document).toContain("fr.wikipedia.org/w/index.php?curid=42");
  expect(document).toContain("oldid=91");
  expect(document).toContain("action=history");
  expect(document).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
  expect(document).toContain(new Date(article.retrievedAt).toISOString());
  expect(document).toContain("Texte extrait");
  const english = wikipediaDocument({ ...article, language: "en", pageId: 71 });
  expect(english).toContain("en.wikipedia.org/w/index.php?curid=71");
  expect(english).not.toContain("fr.wikipedia.org");
  expect(() => wikipediaDocument({ ...article, revision: 0 })).toThrow();
});
