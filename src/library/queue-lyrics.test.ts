import { expect, it } from "vitest";
import { acquireQueueLyrics, queueHasLyrics } from "./queue-lyrics";
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

it("preserves the provider's failure reason without abandoning subsequent tracks", async () => {
  const errors: string[] = [];
  await acquireQueueLyrics(["first", "next"], {
    current: () => true,
    available: async () => false,
    acquire: async (reference) => {
      if (reference === "first") throw Error("Provider unavailable");
    },
    progress: () => {},
    failure: (reference, reason) => errors.push(`${reference}: ${reason}`),
  });
  expect(errors).toEqual(["first: Provider unavailable"]);
});

it("disables only fully retained queue words and stops probing at the first missing or replaced owner", async () => {
  const reads: string[] = [];
  expect(
    await queueHasLyrics(
      ["a", "a", "b"],
      () => true,
      async (ref) => {
        reads.push(ref);
        return true;
      },
    ),
  ).toBe(true);
  expect(reads).toEqual(["a", "b"]);
  reads.length = 0;
  expect(
    await queueHasLyrics(
      ["a", "b"],
      () => true,
      async (ref) => {
        reads.push(ref);
        return false;
      },
    ),
  ).toBe(false);
  expect(reads).toEqual(["a"]);
  let current = true;
  expect(
    await queueHasLyrics(
      ["a"],
      () => current,
      async () => {
        current = false;
        return true;
      },
    ),
  ).toBe(false);
});
