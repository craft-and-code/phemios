import { expect, it, vi } from "vitest";
import { createWikipediaExplorer } from "./explore";
import { article, storageFixture } from "./wikipedia.test-fixtures";
it("makes no request on creation, offline reading or language reset; saving is explicit", async () => {
  const api = {
    search: vi.fn(async () => ({ language: "fr", rows: [{ pageId: 42, title: article.title }] })),
    read: vi.fn(async () => article),
  };
  const storage = storageFixture(),
    state = createWikipediaExplorer(api, () => "fr", storage);
  expect(api.read).not.toHaveBeenCalled();
  expect(api.search).not.toHaveBeenCalled();
  await state.search("audio");
  expect(state.hits()).toHaveLength(1);
  await state.open({ pageId: 42, title: article.title });
  expect(state.article()).toEqual(article);
  expect(storage.getItem()).toBe(null);
  state.save();
  expect(state.retained()).toBe(true);
  state.reset();
  await state.open({ pageId: 42, title: article.title });
  expect(api.read).toHaveBeenCalledTimes(1);
  await state.open({ pageId: 42, title: article.title }, true);
  expect(api.read).toHaveBeenCalledTimes(2);
  state.saved.remove(article);
  expect(state.retained()).toBe(false);
});
it("ignores obsolete search responses after reset, language changes and disposal", async () => {
  let resolve!: (value: unknown) => void,
    lang: "fr" | "en" = "fr";
  const api = {
    search: () =>
      new Promise((done) => {
        resolve = done;
      }),
    read: async () => article,
  };
  const state = createWikipediaExplorer(api, () => lang, storageFixture());
  let pending = state.search("audio");
  state.reset();
  resolve({ language: "fr", rows: [{ pageId: 42, title: "Old" }] });
  await pending;
  expect(state.hits()).toEqual([]);
  expect(state.busy()).toBe("");
  pending = state.search("audio");
  lang = "en";
  resolve({ language: "fr", rows: [{ pageId: 42, title: "Old" }] });
  await pending;
  expect(state.hits()).toEqual([]);
  pending = state.search("audio");
  state.dispose();
  resolve({ language: "en", rows: [{ pageId: 42, title: "Old" }] });
  await pending;
  expect(state.hits()).toEqual([]);
});
it("reports read failures, refuses replaced identities and discards a late article on return", async () => {
  let resolve!: (value: unknown) => void;
  const state = createWikipediaExplorer(
    {
      search: async () => ({}),
      read: () =>
        new Promise((done) => {
          resolve = done;
        }),
    },
    () => "fr",
    storageFixture(),
  );
  let pending = state.open({ pageId: 42, title: "Title" });
  state.back();
  resolve(article);
  await pending;
  expect(state.article()).toBe(null);
  pending = state.open({ pageId: 43, title: "Title" });
  resolve(article);
  await pending;
  expect(state.error()).toContain("invalide");
  expect(state.article()).toBe(null);
  expect(state.busy()).toBe("");
  const failed = createWikipediaExplorer(
    {
      search: async () => {
        throw Error("Offline");
      },
      read: async () => {
        throw Error("Offline");
      },
    },
    () => "fr",
    storageFixture(),
  );
  await failed.search("audio");
  expect(failed.error()).toContain("Offline");
  await failed.open({ pageId: 42, title: "Title" });
  expect(failed.error()).toContain("Offline");
  expect(failed.busy()).toBe("");
});
it("prevents duplicate requests and rejects empty or oversized searches before network access", async () => {
  let resolve!: (value: unknown) => void;
  const api = {
    search: vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
    read: vi.fn(async () => article),
  };
  const state = createWikipediaExplorer(api, () => "fr", storageFixture());
  await state.search(" ");
  await state.search("x".repeat(201));
  expect(api.search).not.toHaveBeenCalled();
  const pending = state.search(" R&B ");
  await state.search("Again");
  await state.open({ pageId: 42, title: "Music" });
  expect(api.search).toHaveBeenCalledTimes(1);
  expect(api.search).toHaveBeenCalledWith("fr", "R&B");
  expect(api.read).not.toHaveBeenCalled();
  resolve({ language: "fr", rows: [] });
  await pending;
  expect(state.searched()).toBe(true);
});
