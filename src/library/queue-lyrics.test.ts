import { expect, it } from "vitest";
import { acquireQueueLyrics } from "./queue-lyrics";
it("deduplicates, skips retained lyrics, continues failures and serializes acquisition", async () => {
  const starts: string[] = [];
  let active = 0;
  const result = await acquireQueueLyrics(["a", "b", "a", "c"], {
    current: () => true,
    available: async (r) => r === "b",
    acquire: async (r) => {
      expect(active++).toBe(0);
      starts.push(r);
      await Promise.resolve();
      active--;
      if (r === "a") throw new Error("Unavailable");
    },
    progress: () => {},
  });
  expect(starts).toEqual(["a", "c"]);
  expect(result).toEqual({ done: 3, total: 3, failed: 1 });
});
it("stops before submitting work after an owner change", async () => {
  let current = true,
    starts = 0;
  await acquireQueueLyrics(["a", "b"], {
    current: () => current,
    available: async () => {
      current = false;
      return false;
    },
    acquire: async () => {
      starts++;
    },
    progress: () => {},
  });
  expect(starts).toBe(0);
});
