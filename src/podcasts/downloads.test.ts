import { createRoot } from "solid-js";
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
