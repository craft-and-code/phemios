import { createRoot, createSignal } from "solid-js";
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

it("hides retained lyric errors as soon as their queue owner is replaced or logs out", async () => {
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  vi.mocked(requestAede).mockRejectedValueOnce(new Error("Previous owner's private words"));
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () => [{ reference: "track:first", title: "First" }],
      sessionFor: () => session(),
      tasks: { start: vi.fn(), jobs: () => [] },
    });
  });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(job.retained()?.error).toContain("private words");
  vi.mocked(requestAede).mockReturnValue(new Promise(() => {}));
  setSession({ ...owner, account: { ...owner.account, id: "replacement" } });
  expect(job.retained()).toBeUndefined();
  setSession(undefined);
  expect(job.retained()).toBeUndefined();
  dispose();
});
it("hides a completed batch's private-title feedback after its captured owner leaves", async () => {
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  vi.mocked(requestAede).mockImplementation(async (path, query) =>
    path.endsWith("/status")
      ? { capabilities: ["fetch_track_lyrics"] }
      : { track: query?.track, lyrics: null },
  );
  const failure: Job = {
    task_id: 1,
    source: "server",
    kind: "lyrics",
    release: "track:first",
    status: "failed",
    error: { message: "Provider missing" },
  };
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () => [{ reference: "track:first", title: "Private title" }],
      sessionFor: () => session(),
      tasks: { start: vi.fn(async () => 1), jobs: () => [failure] },
    });
  });
  await job.acquire();
  expect(job.message()).toContain("Private title");
  expect(job.failed()).toBe(true);
  setSession(undefined);
  expect(job.message()).toBe("");
  expect(job.failed()).toBe(false);
  dispose();
});

it("probes every queue occurrence and publishes confirmed availability before the batch finishes", async () => {
  let dispose!: () => void, finish!: () => void;
  const retained = new Set(["track:first"]),
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
                lines: [{ text: "Fixture words", at_ms: null }],
              }
            : null,
        },
  );
  const start = vi.fn(async (_kind, reference: string) => {
    if (reference === "track:last")
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    retained.add(reference);
    const task_id = jobs.length + 1;
    jobs.push({
      task_id,
      source: "server",
      kind: "lyrics",
      release: reference,
      status: "completed",
    });
    return task_id;
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () =>
        ["first", "next", "last"].map((name) => ({ reference: `track:${name}`, title: name })),
      sessionFor: () => owner,
      tasks: { start, jobs: () => jobs },
    });
  });
  try {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(job.available("track:first")).toBe(true);
    expect(job.available("track:next")).toBe(false);
    expect(job.available("track:last")).toBe(false);
    const run = job.acquire();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(start.mock.calls.map((call) => call[1])).toEqual(["track:next", "track:last"]);
    expect(job.available("track:next")).toBe(true);
    expect(job.busy()).toBe(true);
    finish();
    await run;
    expect(job.available("track:last")).toBe(true);
    expect(job.retained()?.complete).toBe(true);
  } finally {
    dispose();
  }
});

it("acquires one missing queue track and hides all availability on account replacement", async () => {
  let dispose!: () => void;
  const [session, setSession] = createSignal<AccountSession | undefined>(owner),
    retained = new Set<string>(),
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
                lines: [{ text: "Words", at_ms: null }],
              }
            : null,
        },
  );
  const start = vi.fn(async (_kind, reference: string) => {
    retained.add(reference);
    jobs.push({
      task_id: 1,
      source: "server",
      kind: "lyrics",
      release: reference,
      status: "completed",
    });
    return 1;
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () => ["first", "next"].map((name) => ({ reference: `track:${name}`, title: name })),
      sessionFor: session,
      tasks: { start, jobs: () => jobs },
    });
  });
  try {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await job.acquire("track:next");
    expect(start).toHaveBeenCalledExactlyOnceWith("lyrics", "track:next", false);
    expect(job.available("track:next")).toBe(true);
    vi.mocked(requestAede).mockReturnValue(new Promise(() => {}));
    setSession({ ...owner, account: { ...owner.account, id: "other" } });
    expect(job.available("track:next")).toBeUndefined();
    expect(job.retained()).toBeUndefined();
    setSession(undefined);
    expect(job.available("track:first")).toBeUndefined();
  } finally {
    dispose();
  }
});

it("retains the newer confirmed lyric result when an earlier missing probe completes late", async () => {
  let dispose!: () => void, finish!: (value: unknown) => void;
  let retained = false,
    reads = 0;
  const jobs: Job[] = [];
  vi.mocked(requestAede).mockImplementation(async (path, query) => {
    if (path.endsWith("/status")) return { capabilities: ["fetch_track_lyrics"] };
    if (++reads === 1)
      return await new Promise((resolve) => {
        finish = resolve;
      });
    return {
      track: query?.track,
      lyrics: retained
        ? { source: "tag", synced: false, lines: [{ text: "Confirmed new words", at_ms: null }] }
        : null,
    };
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () => [{ reference: "track:first", title: "First" }],
      sessionFor: () => owner,
      tasks: {
        start: vi.fn(async () => {
          retained = true;
          jobs.push({
            task_id: 1,
            source: "server",
            kind: "lyrics",
            release: "track:first",
            status: "completed",
          });
          return 1;
        }),
        jobs: () => jobs,
      },
    });
  });
  try {
    await job.acquire("track:first");
    expect(job.available("track:first")).toBe(true);
    finish({ track: "track:first", lyrics: null });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(job.available("track:first")).toBe(true);
  } finally {
    dispose();
  }
});

it("keeps a captured batch's retained-word checks when its visible queue is replaced", async () => {
  let dispose!: () => void;
  const [queue, setQueue] = createSignal([{ reference: "track:first", title: "First" }]);
  let replace = false;
  vi.mocked(requestAede).mockImplementation(async (path, query) => {
    if (path.endsWith("/status")) {
      if (replace) setQueue([{ reference: "track:replacement", title: "Replacement" }]);
      return { capabilities: ["fetch_track_lyrics"] };
    }
    return {
      track: query?.track,
      lyrics: { source: "tag", synced: false, lines: [{ text: "Already retained", at_ms: null }] },
    };
  });
  const start = vi.fn(async () => {
    throw new Error("Unexpected retained-track acquisition");
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({ queue, sessionFor: () => owner, tasks: { start, jobs: () => [] } });
  });
  try {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    replace = true;
    await job.acquire();
    expect(start).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});

it("refreshes only the completed track instead of re-probing every retained queue entry", async () => {
  let dispose!: () => void;
  const [jobs, setJobs] = createSignal<Job[]>([]),
    reads = new Map<string, number>(),
    retained = new Set<string>();
  vi.mocked(requestAede).mockImplementation(async (_path, query) => {
    const reference = String(query?.track);
    reads.set(reference, (reads.get(reference) ?? 0) + 1);
    return {
      track: reference,
      lyrics: retained.has(reference)
        ? { source: "tag", synced: false, lines: [{ text: "Confirmed words", at_ms: null }] }
        : null,
    };
  });
  const job = createRoot((cleanup) => {
    dispose = cleanup;
    return createQueueLyrics({
      queue: () =>
        ["first", "next", "last"].map((name) => ({ reference: `track:${name}`, title: name })),
      sessionFor: () => owner,
      tasks: { start: vi.fn(), jobs },
    });
  });
  try {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect([...reads.values()]).toEqual([1, 1, 1]);
    retained.add("track:next");
    setJobs([
      { task_id: 1, source: "server", kind: "lyrics", release: "track:next", status: "completed" },
    ]);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(job.available("track:next")).toBe(true);
    expect(reads.get("track:first")).toBe(1);
    expect(reads.get("track:last")).toBe(1);
    expect(reads.get("track:next")).toBe(2);
  } finally {
    dispose();
  }
});

it("cancels the captured server task even when Stop precedes its submission acknowledgement", async () => {
  let finish!: (id: number) => void, dispose!: () => void;
  vi.mocked(requestAede).mockImplementation(async (path, query) =>
    path.endsWith("/status")
      ? { capabilities: ["fetch_track_lyrics"] }
      : { track: query?.track, lyrics: null },
  );
  const cancel = vi.fn(async () => {}),
    start = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
  const controller = createRoot((end) => {
    dispose = end;
    return createQueueLyrics({
      queue: () => [{ reference: "track:first", title: "First" }],
      sessionFor: () => owner,
      tasks: { jobs: () => [], start, cancel },
    });
  });
  const pending = controller.acquire("track:first");
  for (let i = 0; i < 30; i++) await Promise.resolve();
  expect(start).toHaveBeenCalledOnce();
  await controller.cancel();
  finish(81);
  await pending;
  expect(cancel).toHaveBeenCalledExactlyOnceWith(81, "server");
  expect(controller.busy()).toBe(false);
  dispose();
});
