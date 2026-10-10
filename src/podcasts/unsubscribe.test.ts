import { expect, it } from "vitest";
import { createUnsubscribe } from "./unsubscribe";
it("keeps subscriptions until explicit confirmation and targets the captured feed", () => {
  const removed: string[] = [];
  const confirmation = createUnsubscribe((url) => {
    removed.push(url);
    return true;
  });
  confirmation.ask({ url: "https://example.org/first.xml", title: "First" });
  expect(removed).toEqual([]);
  confirmation.cancel();
  expect(confirmation.confirm()).toBe(false);
  confirmation.ask({ url: "https://example.org/second.xml", title: "Second" });
  expect(confirmation.confirm()).toBe(true);
  expect(removed).toEqual(["https://example.org/second.xml"]);
  expect(confirmation.pending()).toBeUndefined();
});
it("retains the pending confirmation when persistence refuses removal", () => {
  const confirmation = createUnsubscribe(() => false);
  confirmation.ask({ url: "https://example.org/feed.xml", title: "Feed" });
  expect(confirmation.confirm()).toBe(false);
  expect(confirmation.pending()?.title).toBe("Feed");
});
