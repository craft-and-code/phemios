import { expect, it } from "vitest";
import { createSubscriptions, readSubscriptions } from "./subscriptions";
import { feed } from "./test-fixtures";
it("persists RSS subscription updates and unsubscribe without duplicating the same feed", () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_k: string, value: string) => {
      raw = value;
    },
  };
  const subscriptions = createSubscriptions(storage);
  expect(subscriptions.save(feed)).toBe(true);
  expect(readSubscriptions(storage)).toEqual([feed]);
  expect(subscriptions.save({ ...feed, title: "Updated" })).toBe(true);
  expect(subscriptions.feeds()).toHaveLength(1);
  expect(readSubscriptions(storage)[0]?.title).toBe("Updated");
  expect(subscriptions.remove(feed.url)).toBe(true);
  expect(readSubscriptions(storage)).toEqual([]);
});
it("preserves corrupt stores and refuses failed writes instead of claiming subscription success", () => {
  let writes = 0;
  const subscriptions = createSubscriptions({
    getItem: () => "{broken",
    setItem: () => {
      writes++;
    },
  });
  expect(subscriptions.error()).not.toBe("");
  expect(subscriptions.save(feed)).toBe(false);
  expect(writes).toBe(0);
  const failed = createSubscriptions({
    getItem: () => null,
    setItem: () => {
      throw new Error("No space");
    },
  });
  expect(failed.save(feed)).toBe(false);
  expect(failed.feeds()).toEqual([]);
  expect(failed.error()).toContain("No space");
});
