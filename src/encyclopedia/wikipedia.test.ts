import { expect, it } from "vitest";
import { wikipediaArticle, wikipediaBlocks, wikipediaLinks, wikipediaSearch } from "./wikipedia";
import { article } from "./wikipedia.test-fixtures";
it("validates article identity, limits and provenance while preserving literal text", () => {
  expect(wikipediaArticle({ ...article, text: "<script>literal</script>" }).text).toBe(
    "<script>literal</script>",
  );
  for (const change of [
    { language: "de" },
    { pageId: 0 },
    { revision: Infinity },
    { title: "" },
    { text: " " },
    { text: "a".repeat(512 * 1024 + 1) },
    { text: "bad\u0001" },
    { retrievedAt: 0 },
    { retrievedAt: Number.MAX_SAFE_INTEGER },
  ])
    expect(() => wikipediaArticle({ ...article, ...change })).toThrow();
  expect(wikipediaLinks(article)).toEqual({
    article: "https://fr.wikipedia.org/w/index.php?curid=42",
    revision: "https://fr.wikipedia.org/w/index.php?oldid=91",
    authors: "https://fr.wikipedia.org/w/index.php?curid=42&action=history",
    license: "https://creativecommons.org/licenses/by-sa/4.0/",
  });
});
it("rejects malformed search pages, foreign languages, duplicates and oversized results", () => {
  const rows = [{ pageId: 42, title: "Music" }];
  expect(wikipediaSearch({ language: "fr", rows }, "fr")).toEqual(rows);
  for (const value of [
    null,
    { language: "en", rows },
    { language: "fr", rows: [...rows, ...rows] },
    { language: "fr", rows: Array(21).fill(rows[0]) },
    { language: "fr", rows: [{ pageId: -1, title: "X" }] },
  ])
    expect(() => wikipediaSearch(value, "fr")).toThrow();
});
it("reads headings on their own line without losing adjacent prose or interpreting markup", () => {
  expect(
    wikipediaBlocks("Intro\n\n== History ==\nText\n\n=== Technique ===\n<svg>literal</svg>"),
  ).toEqual([
    { heading: false, text: "Intro" },
    { heading: true, text: "History" },
    { heading: false, text: "Text" },
    { heading: true, text: "Technique" },
    { heading: false, text: "<svg>literal</svg>" },
  ]);
});
