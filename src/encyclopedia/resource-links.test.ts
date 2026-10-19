import addresses from "../../tests/fixtures/wikipedia-resource-addresses.json";
import { expect, it } from "vitest";
import { linkResourceBlocks } from "./resource-links";
import { wikipediaArticle, wikipediaBlocks } from "./wikipedia";
import { article } from "./wikipedia.test-fixtures";
import { articleRetained, createSavedArticles } from "./saved";
import { wikipediaDocument } from "./document";
import { storageFixture } from "./wikipedia.test-fixtures";
const links = [
  { label: "Example Music", url: "https://music.example/artist?a=1&b=2" },
  { label: "Archive", url: "https://archive.example/id" },
  { label: "Archive", url: "https://archive.example/other" },
];
it("retains resource labels and addresses through parsing, personal copies and readable downloads", () => {
  const enriched = wikipediaArticle({ ...article, externalLinks: links });
  expect(enriched.externalLinks).toEqual(links);
  const storage = storageFixture();
  const saved = createSavedArticles(storage);
  expect(saved.save(enriched)).toBe(true);
  expect(createSavedArticles(storage).rows()[0]?.externalLinks).toEqual(links);
  expect(wikipediaDocument(enriched)).toContain(`${links[0]!.label} : ${links[0]!.url}`);
  expect(articleRetained(enriched, [article])).toBe(false);
  expect(articleRetained(enriched, [enriched])).toBe(true);
  expect(wikipediaArticle(article).externalLinks).toBeUndefined();
});
it("links only the external section and preserves repeated labels, literal text and unmatched resources", () => {
  const text =
    "Example Music in the biography.\n\n=== Liens externes ===\n\nRessources relatives à la musique : Example Music · Archive · Archive\n\n== Other ==\nExample Music";
  const read = linkResourceBlocks(wikipediaBlocks(text), [
    ...links,
    { label: "Missing label", url: "https://missing.example/" },
  ]);
  expect(read.blocks[0]?.parts).toEqual([{ text: "Example Music in the biography." }]);
  const resource = read.blocks.find((block) => block.text.startsWith("Ressources"))!;
  expect(resource.parts.filter((part) => part.url).map((part) => part.url)).toEqual(
    links.map((link) => link.url),
  );
  expect(resource.parts.map((part) => part.text).join("")).toBe(resource.text);
  expect(read.unmatched).toEqual([{ label: "Missing label", url: "https://missing.example/" }]);
  expect(
    linkResourceBlocks(wikipediaBlocks("== External links ==\nArchive"), [links[1]!]).unmatched,
  ).toEqual([]);
});
it("rejects active, local, credentialled, duplicate and oversized resource metadata before rendering", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,a",
    "file:///private/test",
    "http://localhost/",
    "http://localhost./",
    "http://127.1/",
    "https://music.local/",
    "https://user:pass@music.example/",
    "https://music.example:444/",
    "https://music.example/#\n",
    "https://music.example/\\test",
  ])
    expect(() =>
      wikipediaArticle({ ...article, externalLinks: [{ label: "Unsafe", url }] }),
    ).toThrow();
  expect(() => wikipediaArticle({ ...article, externalLinks: [links[0], links[0]] })).toThrow();
  expect(() =>
    wikipediaArticle({
      ...article,
      externalLinks: [{ label: "x".repeat(513), url: links[0]!.url }],
    }),
  ).toThrow();
  expect(() =>
    wikipediaArticle({
      ...article,
      externalLinks: Array.from({ length: 257 }, (_, i) => ({
        label: `Label ${i}`,
        url: `https://music.example/${i}`,
      })),
    }),
  ).toThrow();
});

it("rejects resource ports rejected by the native system-browser handoff", () => {
  for (const url of ["http://music.example:443/", "https://music.example:80/"])
    expect(() =>
      wikipediaArticle({ ...article, externalLinks: [{ label: "Music", url }] }),
    ).toThrow();
});

it("does not consume a provider label inside another word before its actual standalone occurrence", () => {
  const link = { label: "Archive", url: "https://archive.example/artist" };
  const reading = linkResourceBlocks(
    wikipediaBlocks("== Liens externes ==\nTheArchiveMuseum is unrelated.\n\nArchive"),
    [link],
  );
  expect(reading.blocks[1]?.parts).toEqual([{ text: "TheArchiveMuseum is unrelated." }]);
  expect(reading.blocks[2]?.parts).toEqual([{ text: "Archive", url: link.url }]);
  expect(reading.unmatched).toEqual([]);
});

it("agrees with native resource-address admission for the shared browser-normalization matrix", () => {
  for (const { url, valid } of addresses) {
    const read = () => wikipediaArticle({ ...article, externalLinks: [{ label: "Music", url }] });
    if (valid) expect(read().externalLinks?.[0]?.url).toBe(url);
    else expect(read, url).toThrow();
  }
});
