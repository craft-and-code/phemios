import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createAccountSavedArticles } from "./account-saved";
import type { AccountSession } from "../library/server";
import { article } from "./wikipedia.test-fixtures";
const owner = (id: string, role = "user"): AccountSession => ({
  server: "https://music.example",
  nativeSession: id,
  account: { id, username: "same name", role },
});
const state = (articles = [article]) => ({ version: 1, articles });
async function settle() {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
}
it("clears Alice immediately on logout/Bob and refuses late native copies across full session/source changes", async () => {
  await createRoot(async (dispose) => {
    const [session, setSession] = createSignal<AccountSession | undefined>(owner("alice"));
    const [source, setSource] = createSignal<"local" | "server">("server");
    let finish!: (value: unknown) => void;
    const read = vi.fn(async (): Promise<unknown> => state());
    const copies = createAccountSavedArticles(session, source, {
      read,
      update: async () => state(),
    });
    try {
      await settle();
      expect(copies.rows()).toEqual([article]);
      setSession(undefined);
      expect(copies.rows()).toEqual([]);
      expect(copies.writable()).toBe(false);
      read.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      setSession(owner("bob"));
      await settle();
      expect(copies.rows()).toEqual([]);
      setSource("local");
      await settle();
      finish(state([{ ...article, title: "Obsolete private server copy" }]));
      await settle();
      expect(read).toHaveBeenLastCalledWith("local", session());
      expect(copies.rows()).toEqual([article]);
      expect(copies.loading()).toBe(false);
    } finally {
      dispose();
    }
  });
});
it("publishes no old write/error and sends no queued mutation to a replaced native session", async () => {
  await createRoot(async (dispose) => {
    const alice = owner("alice"),
      [session, setSession] = createSignal<AccountSession | undefined>(alice);
    let finish!: (value: unknown) => void;
    const update = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const copies = createAccountSavedArticles(session, () => "server", {
      read: async () => state(),
      update,
    });
    try {
      await settle();
      const first = copies.save(article),
        queued = copies.remove(article);
      await settle();
      expect(update).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledWith("save", article, "server", alice);
      setSession(owner("bob"));
      await settle();
      finish(state([{ ...article, title: "Alice private copy" }]));
      await first;
      await queued;
      expect(update).toHaveBeenCalledOnce();
      expect(copies.rows()[0]?.title).toBe(article.title);
      expect(copies.error()).toBe("");
      expect(copies.pending()).toBe(false);
    } finally {
      dispose();
    }
  });
});
it("leaves unsupported/corrupt private stores unavailable and never writes as an auditor", async () => {
  await createRoot(async (dispose) => {
    const [session, setSession] = createSignal(owner("auditor", "auditor"));
    const read = vi.fn(async () => state()),
      update = vi.fn(async () => state());
    const copies = createAccountSavedArticles(session, () => "server", { read, update });
    try {
      await settle();
      expect(copies.rows()).toHaveLength(1);
      expect(copies.writable()).toBe(false);
      expect(await copies.save(article)).toBe(false);
      expect(update).not.toHaveBeenCalled();
      read.mockResolvedValueOnce({ version: 1, articles: [article, article] });
      setSession(owner("new"));
      await settle();
      expect(copies.rows()).toEqual([]);
      expect(copies.error()).not.toBe("");
      expect(await copies.save(article)).toBe(false);
      expect(update).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});

it("rejects byte-overflow private stores without evicting their copies or allowing a write", async () => {
  await createRoot(async (dispose) => {
    const update = vi.fn(async () => state());
    const oversized = Array.from({ length: 6 }, (_, index) => ({
      ...article,
      pageId: index + 1,
      text: "あ".repeat(200000),
    }));
    const copies = createAccountSavedArticles(
      () => owner("alice"),
      () => "server",
      {
        read: async () => state(oversized),
        update,
      },
    );
    try {
      await settle();
      expect(copies.rows()).toEqual([]);
      expect(copies.error()).not.toBe("");
      expect(await copies.save(article)).toBe(false);
      expect(update).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});
it("ignores an old read failure and a result after disposal", async () => {
  await createRoot(async (dispose) => {
    const [session, setSession] = createSignal(owner("alice"));
    let reject!: (error: unknown) => void;
    const read = vi.fn(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const copies = createAccountSavedArticles(session, () => "server", {
      read,
      update: async () => state(),
    });
    await settle();
    const old = reject;
    read.mockImplementationOnce(async () => state([]));
    setSession(owner("bob"));
    await settle();
    old(new Error("Alice private store path"));
    await settle();
    expect(copies.error()).toBe("");
    expect(copies.rows()).toEqual([]);
    setSession(owner("other"));
    await settle();
    dispose();
    reject(new Error("Disposed private store"));
    await settle();
    expect(copies.error()).toBe("");
    expect(copies.rows()).toEqual([]);
  });
});

it("admits the exact native article-array byte limit and rejects one additional byte", async () => {
  await createRoot(async (dispose) => {
    const [session, setSession] = createSignal(owner("alice"));
    const maximum = 3 * 1024 * 1024;
    const articles = Array.from({ length: 6 }, (_, index) => ({
      ...article,
      pageId: index + 1,
      text: "x".repeat(512 * 1024),
    }));
    const excess = new TextEncoder().encode(JSON.stringify(articles)).byteLength - maximum;
    articles.forEach((row, index) => {
      if (index === 5) row.text = row.text.slice(0, -excess);
    });
    expect(new TextEncoder().encode(JSON.stringify(articles)).byteLength).toBe(maximum);
    const read = vi.fn(async () => state(articles));
    const copies = createAccountSavedArticles(session, () => "server", {
      read,
      update: async () => state(),
    });
    try {
      await settle();
      expect(copies.rows()).toHaveLength(6);
      expect(copies.writable()).toBe(true);
      read.mockResolvedValueOnce(
        state(articles.map((row, index) => (index === 5 ? { ...row, text: `${row.text}x` } : row))),
      );
      setSession(owner("bob"));
      await settle();
      expect(copies.rows()).toEqual([]);
      expect(copies.writable()).toBe(false);
      expect(copies.error()).not.toBe("");
    } finally {
      dispose();
    }
  });
});

it("retires failed and queued biography saves after logout and return to the same owner", async () => {
  await createRoot(async (dispose) => {
    const alice = owner("alice");
    const [session, setSession] = createSignal<AccountSession | undefined>(alice);
    let fail!: (error: unknown) => void;
    const update = vi.fn(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const copies = createAccountSavedArticles(session, () => "server", {
      read: async () => state([]),
      update,
    });
    try {
      await settle();
      const first = copies.save(article);
      const queued = copies.save({ ...article, pageId: 43 });
      await settle();
      setSession(undefined);
      setSession(alice);
      await settle();
      fail(new Error("retired private save path"));
      expect(await first).toBe(false);
      expect(await queued).toBe(false);
      expect(update).toHaveBeenCalledOnce();
      expect(copies.error()).toBe("");
      expect(copies.rows()).toEqual([]);
      expect(copies.writable()).toBe(true);
    } finally {
      dispose();
    }
  });
});
it("retires an in-flight save and refuses a queued removal when the reader is disposed", async () => {
  let finish!: (value: unknown) => void;
  const update = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let dispose!: () => void;
  const copies = createRoot((cleanup) => {
    dispose = cleanup;
    return createAccountSavedArticles(
      () => owner("alice"),
      () => "server",
      {
        read: async () => state([]),
        update,
      },
    );
  });
  await settle();
  const first = copies.save(article);
  const queued = copies.remove(article);
  await settle();
  dispose();
  finish(state());
  expect(await first).toBe(false);
  expect(await queued).toBe(false);
  expect(update).toHaveBeenCalledOnce();
  expect(copies.rows()).toEqual([]);
  expect(copies.error()).toBe("");
});

it("does not publish resource links or delayed failures from a retired account save", async () => {
  await createRoot(async (dispose) => {
    const [session, setSession] = createSignal(owner("alice"));
    let fail!: (error: unknown) => void;
    const copies = createAccountSavedArticles(session, () => "server", {
      read: async () => state([]),
      update: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    });
    try {
      await settle();
      const pending = copies.save({
        ...article,
        externalLinks: [{ label: "Private saved resource", url: "https://music.example/artist" }],
      });
      await settle();
      setSession(owner("bob"));
      await settle();
      fail(new Error("Alice private saved resource"));
      expect(await pending).toBe(false);
      expect(copies.rows()).toEqual([]);
      expect(copies.error()).toBe("");
      expect(copies.writable()).toBe(true);
    } finally {
      dispose();
    }
  });
});
