import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import { createQueueLyrics } from "./queue-lyrics-controller";
import { requestAede } from "../platform/desktop";
import type { Job } from "./jobs";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const owner: AccountSession = {
  server: "http://127.0.0.1:8787",
  account: { id: "listener", username: "listener", role: "admin" },
};
it("continues sequential lyric acquisition after its presentation owner is disposed", async () => {
  let finish!: () => void, dispose!: () => void, hide!: () => void;
  const retained = new Set<string>(),
    jobs: Job[] = [];
  vi.mocked(requestAede).mockImplementation(async (path, query) =>
    path.endsWith("/status")
      ? { capabilities: ["fetch_track_lyrics"] }
      : {
          track: query?.track,
          lyrics: retained.has(String(query?.track))
            ? {
                source: "tag",
                synced: false,
                lines: [{ text: "Original fixture words", at_ms: null }],
              }
            : null,
        },
  );
  const start = vi.fn(async (_kind, ref: string) => {
    if (ref === "track:first")
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    retained.add(ref);
    const id = jobs.length + 1;
    jobs.push({ task_id: id, source: "server", kind: "lyrics", release: ref, status: "completed" });
    return id;
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () => [
        { reference: "track:first", title: "First" },
        { reference: "track:next", title: "Next" },
      ],
      sessionFor: () => owner,
      tasks: { start, jobs: () => jobs },
    });
  });
  createRoot((cleanup) => {
    hide = cleanup;
    job.busy();
  });
  try {
    const run = job.acquire();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(start).toHaveBeenCalledTimes(1);
    hide();
    expect(job.busy()).toBe(true);
    finish();
    await run;
    expect(start.mock.calls.map((call) => call[1])).toEqual(["track:first", "track:next"]);
    expect(job.busy()).toBe(false);
    expect(job.message()).toContain("2/2");
  } finally {
    dispose();
  }
});
it("stops a captured lyric batch when its account is replaced", async () => {
  let current: AccountSession | undefined = owner,
    dispose!: () => void;
  vi.mocked(requestAede).mockImplementation(async (path) =>
    path.endsWith("/status")
      ? { capabilities: ["fetch_track_lyrics"] }
      : { track: "track:first", lyrics: null },
  );
  const start = vi.fn(async () => {
    current = undefined;
    return 1;
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () => [
        { reference: "track:first", title: "First" },
        { reference: "track:next", title: "Next" },
      ],
      sessionFor: () => current,
      tasks: { start, jobs: () => [] },
    });
  });
  try {
    await job.acquire();
    expect(start).toHaveBeenCalledTimes(1);
  } finally {
    dispose();
  }
});
