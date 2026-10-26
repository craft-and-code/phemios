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

it("switches the selected article via its language link, keeps reading and reuses both editions on return", async () => {
  let language: "fr" | "en" = "fr";
  const english = { ...article, language: "en", pageId: 71, title: "English counterpart" };
  const api = {
    search: vi.fn(),
    read: vi.fn(async () => article),
    translate: vi.fn(async () => english),
  };
  const state = createWikipediaExplorer(api, () => language, storageFixture());
  await state.open(article);
  language = "en";
  await state.changeEdition("unrelated search");
  expect(api.translate).toHaveBeenCalledExactlyOnceWith("fr", 42, "en");
  expect(api.search).not.toHaveBeenCalled();
  expect(state.article()).toEqual(english);
  language = "fr";
  await state.changeEdition("");
  expect(state.article()).toEqual(article);
  expect(api.translate).toHaveBeenCalledOnce();
});
it("keeps the original readable when its counterpart is absent, invalid or arrives after returning", async () => {
  let language: "fr" | "en" = "fr";
  let complete!: (value: unknown) => void;
  const api = {
    search: vi.fn(),
    read: vi.fn(async () => article),
    translate: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
  const state = createWikipediaExplorer(api, () => language, storageFixture());
  await state.open(article);
  language = "en";
  api.translate.mockRejectedValueOnce(Error("No counterpart"));
  expect(await state.changeEdition("")).toBe(false);
  expect(state.article()).toEqual(article);
  expect(state.error()).toContain("No counterpart");
  api.translate.mockResolvedValueOnce(article);
  expect(await state.changeEdition("")).toBe(false);
  expect(state.article()).toEqual(article);
  api.translate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = state.changeEdition("");
  expect(state.busy()).toBe("article");
  expect(state.article()).toEqual(article);
  state.back();
  complete({ ...article, language: "en", pageId: 71 });
  await pending;
  expect(state.article()).toBeNull();
  expect(state.busy()).toBe("");
});
it("reruns an existing query in the selected edition, but does not search from an untouched form", async () => {
  let language: "fr" | "en" = "fr";
  const api = {
    search: vi.fn(async () => ({
      language,
      rows: [{ pageId: language === "fr" ? 42 : 71, title: "Title" }],
    })),
    read: vi.fn(),
    translate: vi.fn(),
  };
  const state = createWikipediaExplorer(api, () => language, storageFixture());
  language = "en";
  await state.changeEdition("Music");
  expect(api.search).not.toHaveBeenCalled();
  await state.search("Music");
  language = "fr";
  await state.changeEdition("Music");
  expect(api.search).toHaveBeenLastCalledWith("fr", "Music");
  expect(state.hits()[0]?.pageId).toBe(42);
});

it("downloads the selected edition without fetching it again or saving an in-app copy", async () => {
  const api = {
    search: vi.fn(),
    read: vi.fn(async () => article),
    download: vi.fn(async () => "/downloads/article.txt"),
  };
  const storage = storageFixture(),
    state = createWikipediaExplorer(api, () => "fr", storage);
  await state.open(article);
  await state.download();
  expect(api.download).toHaveBeenCalledExactlyOnceWith(article);
  expect(api.read).toHaveBeenCalledOnce();
  expect(storage.getItem()).toBeNull();
  expect(state.notice()).toContain("article.txt");
  expect(state.retained()).toBe(false);
});
it("rejects duplicate downloads, exposes failures and ignores late export notices after leaving the article", async () => {
  let finish!: (path: string) => void;
  const api = {
    search: vi.fn(),
    read: vi.fn(async () => article),
    download: vi.fn<() => Promise<string>>(),
  };
  const state = createWikipediaExplorer(api, () => "fr", storageFixture());
  await state.open(article);
  api.download.mockRejectedValueOnce(Error("Disk full"));
  await state.download();
  expect(state.error()).toContain("Disk full");
  expect(state.article()).toEqual(article);
  api.download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = state.download();
  await state.download();
  expect(api.download).toHaveBeenCalledTimes(2);
  expect(state.busy()).toBe("download");
  state.back();
  finish("/downloads/old.txt");
  await pending;
  expect(state.notice()).toBe("");
  expect(state.busy()).toBe("");
});

it("acknowledges asynchronous private saves only in the still-open article generation", async () => {
  let finish!: (success: boolean) => void;
  const saved = {
    rows: () => [],
    error: () => "",
    remove: () => true,
    save: vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const state = createWikipediaExplorer(
    { search: async () => ({}), read: async () => article },
    () => "fr",
    saved,
  );
  await state.open(article);
  const request = state.save();
  expect(saved.save).toHaveBeenCalledExactlyOnceWith(article);
  expect(state.notice()).toBe("");
  state.reset();
  finish(true);
  await request;
  expect(state.notice()).toBe("");
  expect(state.article()).toBeNull();
  await state.open(article);
  const current = state.save();
  finish(true);
  await current;
  expect(state.notice()).not.toBe("");
  state.dispose();
});

it("cancels a refresh without dropping the displayed article or accepting a late replacement", async () => {
  let finish!: (value: unknown) => void;
  const read = vi
    .fn()
    .mockResolvedValueOnce(article)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          finish = done;
        }),
    );
  const state = createWikipediaExplorer(
    { read, search: async () => ({ language: "fr", rows: [] }) },
    () => "fr",
    storageFixture(),
  );
  await state.open(article);
  const refresh = state.open(article, true);
  expect(state.busy()).toBe("article");
  state.cancel();
  expect(state.busy()).toBe("");
  expect(state.article()).toEqual(article);
  finish({ ...article, text: "Late changed text" });
  await refresh;
  expect(state.article()).toEqual(article);
});
