import { expect, it } from "vitest";
import { createSavedArticles } from "./saved";
import { article, storageFixture } from "./wikipedia.test-fixtures";
it("restores provenance offline, replaces a revision and keeps language editions separate", () => {
  const storage = storageFixture(),
    saved = createSavedArticles(storage);
  expect(saved.save(article)).toBe(true);
  expect(createSavedArticles(storage).rows()).toEqual([article]);
  saved.save({ ...article, revision: 92 });
  saved.save({ ...article, language: "en" });
  expect(saved.rows().map((row) => [row.language, row.revision])).toEqual([
    ["fr", 92],
    ["en", 91],
  ]);
  saved.remove(article);
  expect(saved.rows()).toEqual([{ ...article, language: "en" }]);
});
it("preserves unreadable stores and last successful rows on failed writes", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ version: 1, articles: [article, article] }),
    JSON.stringify({ version: 2, articles: [] }),
  ]) {
    const storage = storageFixture();
    storage.corrupt(raw);
    const saved = createSavedArticles(storage);
    expect(saved.error()).not.toBe("");
    expect(saved.save(article)).toBe(false);
    expect(saved.remove(article)).toBe(false);
    expect(storage.getItem()).toBe(raw);
  }
  const storage = storageFixture(),
    saved = createSavedArticles(storage);
  saved.save(article);
  const original = storage.getItem();
  storage.fail();
  expect(saved.save({ ...article, revision: 93 })).toBe(false);
  expect(saved.rows()).toEqual([article]);
  expect(storage.getItem()).toBe(original);
});
it("bounds retained copies without deleting older articles to make room", () => {
  const storage = storageFixture(),
    saved = createSavedArticles(storage);
  for (let id = 1; id <= 40; id++) expect(saved.save({ ...article, pageId: id })).toBe(true);
  const original = storage.getItem();
  expect(saved.save({ ...article, pageId: 41 })).toBe(false);
  expect(storage.getItem()).toBe(original);
  expect(saved.save({ ...article, pageId: 1, revision: 92 })).toBe(true);
});
