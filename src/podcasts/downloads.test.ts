import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createEpisodeDownloads } from "./downloads";
it("prevents duplicate requests, reports the path and permits a later retry", async () => {
  let finish!: (path: string) => void,
    calls = 0,
    dispose!: () => void,
    downloads!: ReturnType<typeof createEpisodeDownloads>;
  createRoot((end) => {
    dispose = end;
    downloads = createEpisodeDownloads(() => {
      calls++;
      return new Promise((resolve) => (finish = resolve));
    });
  });
  const pending = downloads.save("https://example.org/episode.mp3", "Episode");
  await downloads.save("https://example.org/episode.mp3", "Episode");
  expect(calls).toBe(1);
  expect(downloads.busy()).toBe("https://example.org/episode.mp3");
  finish("/downloads/Episode.mp3");
  await pending;
  expect(downloads.busy()).toBe("");
  expect(downloads.message()).toContain("/downloads/Episode.mp3");
  expect(downloads.failed()).toBe(false);
  dispose();
});
it("exposes failures and clears the busy state", async () => {
  let dispose!: () => void, downloads!: ReturnType<typeof createEpisodeDownloads>;
  createRoot((end) => {
    dispose = end;
    downloads = createEpisodeDownloads(async () => {
      throw Error("Interrupted");
    });
  });
  await downloads.save("https://example.org/episode.mp3", "Episode");
  expect(downloads.message()).toBe("Interrupted");
  expect(downloads.failed()).toBe(true);
  expect(downloads.busy()).toBe("");
  dispose();
});
it("does not publish a late acknowledgement after the page is closed", async () => {
  let finish!: (path: string) => void,
    dispose!: () => void,
    downloads!: ReturnType<typeof createEpisodeDownloads>;
  createRoot((end) => {
    dispose = end;
    downloads = createEpisodeDownloads(() => new Promise((resolve) => (finish = resolve)));
  });
  const pending = downloads.save("https://example.org/episode.mp3", "Episode");
  dispose();
  finish("/downloads/Episode.mp3");
  await pending;
  expect(downloads.message()).toBe("");
});

it("hides saved episode feedback immediately when its exact owner changes", async () => {
  let dispose!: () => void;
  const alice = {},
    bob = {},
    [owner, setOwner] = createSignal(alice);
  const downloads = createRoot((end) => {
    dispose = end;
    return createEpisodeDownloads(async () => "/downloads/Alice episode.mp3", owner);
  });
  try {
    await downloads.save("https://example.org/a.mp3", "Alice episode");
    expect(downloads.message()).toContain("Alice episode");
    setOwner(bob);
    expect(downloads.message()).toBe("");
    expect(downloads.failed()).toBe(false);
  } finally {
    dispose();
  }
});
it("refuses old-owner success and failure after switching away and back", async () => {
  for (const failure of [false, true]) {
    let dispose!: () => void, finish!: () => void;
    const alice = {},
      bob = {},
      [owner, setOwner] = createSignal(alice);
    const downloads = createRoot((end) => {
      dispose = end;
      return createEpisodeDownloads(
        () =>
          new Promise((resolve, reject) => {
            finish = () =>
              failure ? reject(new Error("Alice episode error")) : resolve("/downloads/Alice.mp3");
          }),
        owner,
      );
    });
    try {
      const pending = downloads.save("https://example.org/a.mp3", "Alice episode");
      setOwner(bob);
      expect(downloads.busy()).toBe("");
      setOwner(alice);
      finish();
      expect(await pending).toBe(false);
      expect(downloads.message()).toBe("");
      expect(downloads.failed()).toBe(false);
    } finally {
      dispose();
    }
  }
});
