import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import { createBiographyReading } from "../library/biography-reading-state";
import { createAccountSavedArticles } from "./account-saved";
import { articleRetained } from "./saved";
import { article } from "./wikipedia.test-fixtures";
import type { AccountSession } from "../library/server";
const owner: AccountSession = {
  server: "https://music.example",
  nativeSession: "owner-ticket",
  account: { id: "listener", username: "listener", role: "user" },
};
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
it("opens a complete biography and stores the same attributed text in private encyclopedia articles", async () => {
  let data = { version: 1, articles: [] as (typeof article)[] },
    dispose!: () => void;
  const api = {
    read: vi.fn(async () => data),
    update: vi.fn(
      async (
        _action: "save" | "remove",
        value: unknown,
        _source: unknown,
        account: AccountSession,
      ) => {
        expect(account).toBe(owner);
        data = { version: 1, articles: [value as typeof article] };
        return data;
      },
    ),
  };
  const active = createRoot((cleanup) => {
    dispose = cleanup;
    return {
      biography: createBiographyReading(
        () => ({
          reference: "artist:fixture",
          biographyCredit: {
            url: "https://fr.wikipedia.org/wiki/Example_music",
            lang: "fr",
            licence: "CC BY-SA 4.0",
          },
        }),
        async () => article,
      ),
      copies: createAccountSavedArticles(
        () => owner,
        () => "server",
        api,
      ),
    };
  });
  try {
    await active.biography.open();
    await settle();
    const complete = active.biography.reading()!;
    expect(await active.copies.save(complete)).toBe(true);
    expect(api.update).toHaveBeenCalledExactlyOnceWith("save", complete, "server", owner);
    expect(articleRetained(complete, active.copies.rows())).toBe(true);
  } finally {
    dispose();
  }
  const reopened = createRoot((cleanup) => {
    dispose = cleanup;
    return createAccountSavedArticles(
      () => owner,
      () => "server",
      api,
    );
  });
  try {
    await settle();
    expect(reopened.rows()).toEqual([article]);
    expect(reopened.rows()[0]?.revision).toBe(article.revision);
    expect(reopened.rows()[0]?.text).toBe(article.text);
  } finally {
    dispose();
  }
});
