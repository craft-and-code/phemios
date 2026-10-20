import { createRoot, createSignal } from "solid-js";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createBackgroundPriority } from "./background-priority";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { Job } from "./jobs";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  request.mockResolvedValue({});
});
afterEach(() => {
  dispose?.();
  vi.useRealTimers();
  request.mockReset();
});
it("renews only during extraction and protects audio even when the view has changed", async () => {
  const owner = {} as AccountSession;
  const [jobs, setJobs] = createSignal<Job[]>([]),
    [playing, setPlaying] = createSignal(true);
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs,
      playing,
      sessions: { local: () => owner, server: () => owner },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(request).not.toHaveBeenCalled();
  setJobs([{ task_id: 1, kind: "mood_features", status: "running", source: "local" }]);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: true }),
    "local",
    owner,
  );
  await vi.advanceTimersByTimeAsync(2000);
  expect(request).toHaveBeenCalledTimes(2);
  setPlaying(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: false }),
    "local",
    owner,
  );
  await vi.advanceTimersByTimeAsync(4000);
  expect(request).toHaveBeenCalledTimes(3);
});
it("does not reject playback or retain a timer when disposed during a failed heartbeat", async () => {
  request.mockRejectedValue(new Error("offline"));
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs: () => [{ task_id: 1, kind: "mood_features", status: "running" }],
      playing: () => true,
      sessions: { local: () => ({}) as AccountSession, server: () => ({}) as AccountSession },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  dispose();
  await vi.advanceTimersByTimeAsync(10000);
  expect(request).toHaveBeenCalledTimes(1);
});

// Each source may have an in-flight reply; retirement must prevent obsolete follow-up work.
it.each(["replacement", "round-trip", "disposal", "pause"] as const)(
  "does not dispatch an obsolete lease after %s",
  async (retirement) => {
    const local = { nativeSession: "local-ticket" } as AccountSession,
      original = { nativeSession: "server-ticket" } as AccountSession,
      [server, setServer] = createSignal<AccountSession | undefined>(original),
      [playing, setPlaying] = createSignal(true),
      [jobs, setJobs] = createSignal<Job[]>([
        { task_id: 1, kind: "mood_features", status: "running", source: "local" },
        { task_id: 2, kind: "mood_features", status: "running", source: "server" },
      ]);
    const finishes: (() => void)[] = [];
    request
      .mockImplementationOnce(() => new Promise<void>((resolve) => finishes.push(resolve)))
      .mockImplementationOnce(() => new Promise<void>((resolve) => finishes.push(resolve)));
    createRoot((clean) => {
      dispose = clean;
      createBackgroundPriority({ jobs, playing, sessions: { local: () => local, server } });
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    if (retirement === "disposal") dispose();
    else if (retirement === "pause") setPlaying(false);
    else {
      // The jobs controller removes old-owner tasks on logout before restoring a new list.
      setJobs([jobs()[0]!]);
      setServer(undefined);
      if (retirement === "replacement")
        setServer({ nativeSession: "replacement-ticket" } as AccountSession);
      else setServer(original);
    }
    finishes.forEach((finish) => finish());
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    if (retirement === "disposal") {
      await vi.advanceTimersByTimeAsync(10000);
      expect(request).toHaveBeenCalledTimes(2);
    } else {
      await vi.advanceTimersByTimeAsync(2000);
      if (retirement === "round-trip") {
        setJobs([
          ...jobs(),
          { task_id: 3, kind: "mood_features", status: "running", source: "server" },
        ]);
        await vi.advanceTimersByTimeAsync(0);
      }
      const localCalls = request.mock.calls.filter((call) => call[4] === "local");
      const serverCalls = request.mock.calls.filter((call) => call[4] === "server");
      expect(localCalls).toHaveLength(2);
      expect(serverCalls).toHaveLength(retirement === "replacement" ? 1 : 2);
      expect(localCalls[1]?.[3]).toEqual(
        expect.objectContaining({ active: retirement !== "pause" }),
      );
      if (serverCalls.length === 2) {
        expect(serverCalls[1]?.[5]).toBe(original);
        expect(serverCalls[1]?.[3]).toEqual(
          expect.objectContaining({ active: retirement !== "pause" }),
        );
      }
    }
  },
);

it("keeps the unaffected source admitted when the first source changes account", async () => {
  const server = { nativeSession: "server-ticket" } as AccountSession,
    [local, setLocal] = createSignal<AccountSession | undefined>({
      nativeSession: "local-ticket",
    } as AccountSession);
  let finish!: () => void;
  request.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs: () => [
        { task_id: 1, kind: "mood_features", status: "running", source: "local" },
        { task_id: 2, kind: "mood_features", status: "running", source: "server" },
      ],
      playing: () => true,
      sessions: { local, server: () => server },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  setLocal(undefined);
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: true }),
    "server",
    server,
  );
});

it("never releases a previous account's lease through its replacement session", async () => {
  const local = { nativeSession: "local-ticket" } as AccountSession,
    original = { nativeSession: "server-ticket" } as AccountSession,
    [server, setServer] = createSignal<AccountSession | undefined>(original),
    [playing, setPlaying] = createSignal(true);
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs: () => [
        { task_id: 1, kind: "mood_features", status: "running", source: "local" },
        { task_id: 2, kind: "mood_features", status: "running", source: "server" },
      ],
      playing,
      sessions: { local: () => local, server },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(2);
  let finish!: () => void;
  const delayed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  request.mockImplementation(async (_path, _query, _method, body, source) => {
    if (source === "server" && (body as { active: boolean }).active) await delayed;
    return {};
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(request).toHaveBeenCalledTimes(4);
  setPlaying(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(5);
  setServer({ nativeSession: "replacement-ticket" } as AccountSession);
  finish();
  await vi.advanceTimersByTimeAsync(4000);
  expect(request).toHaveBeenCalledTimes(5);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: false }),
    "local",
    local,
  );
  expect(
    request.mock.calls
      .filter((call) => call[4] === "server")
      .every((call) => call[5] === original && (call[3] as { active: boolean }).active),
  ).toBe(true);
});

it("protects local extraction without a remote login using the local native session", async () => {
  const local = { nativeSession: "local-only-ticket" } as AccountSession;
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs: () => [{ task_id: 1, kind: "mood_features", status: "running", source: "local" }],
      playing: () => true,
      sessions: { local: () => local, server: () => undefined },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: true }),
    "local",
    local,
  );
});

it.each(["local", "server"] as const)(
  "renews the other source's audio priority while %s is still awaiting a reply",
  async (blocked) => {
    const owners = {
      local: { nativeSession: "local-ticket" } as AccountSession,
      server: { nativeSession: "server-ticket" } as AccountSession,
    };
    const other = blocked === "local" ? "server" : "local";
    let finish!: () => void;
    const delayed = new Promise<void>((resolve) => {
      finish = resolve;
    });
    request.mockImplementation(async (_path, _query, _method, _body, source) => {
      if (source === blocked) await delayed;
      return {};
    });
    const [playing, setPlaying] = createSignal(true);
    createRoot((clean) => {
      dispose = clean;
      createBackgroundPriority({
        jobs: () => [
          { task_id: 1, kind: "mood_features", status: "running", source: "local" },
          { task_id: 2, kind: "mood_features", status: "running", source: "server" },
        ],
        playing,
        sessions: { local: () => owners.local, server: () => owners.server },
      });
    });
    try {
      await vi.advanceTimersByTimeAsync(6000);
      const sent = (source: "local" | "server") =>
        request.mock.calls.filter((call) => call[4] === source);
      expect(sent(blocked)).toHaveLength(1);
      expect(sent(other)).toHaveLength(4);
      expect(
        sent(other).every(
          (call) => call[5] === owners[other] && (call[3] as { active: boolean }).active,
        ),
      ).toBe(true);
      setPlaying(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(sent(other)).toHaveLength(5);
      expect(sent(other)[4]?.[3]).toEqual(expect.objectContaining({ active: false }));
      dispose();
      finish();
      await vi.advanceTimersByTimeAsync(10000);
      expect(sent(other)).toHaveLength(5);
      expect(sent(blocked)).toHaveLength(1);
    } finally {
      dispose();
      finish();
    }
  },
);

it("uses separate lease keys when both sources address the same account on one server", async () => {
  const owner = { nativeSession: "shared-server-ticket" } as AccountSession;
  const [jobs, setJobs] = createSignal<Job[]>([
    { task_id: 1, kind: "mood_features", status: "running", source: "local" },
    { task_id: 2, kind: "mood_features", status: "running", source: "server" },
  ]);
  const [playing, setPlaying] = createSignal(true);
  const leases = new Set<string>();
  request.mockImplementation(async (_path, _query, _method, body) => {
    const row = body as { client: string; active: boolean };
    if (row.active) leases.add(row.client);
    else leases.delete(row.client);
    return {};
  });
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs,
      playing,
      sessions: { local: () => owner, server: () => owner },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(leases.size).toBe(2);
  const serverCall = request.mock.calls.find((call) => call[4] === "server");
  expect(serverCall).toBeDefined();
  const serverKey = (serverCall![3] as { client: string }).client;
  setJobs([jobs()[1]!]);
  await vi.advanceTimersByTimeAsync(0);
  expect([...leases]).toEqual([serverKey]);
  setPlaying(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(leases.size).toBe(0);
});

it.each([
  ["local", "pause"],
  ["server", "pause"],
  ["local", "completed"],
  ["server", "completed"],
] as const)("stops failed priority-release retries for %s after %s", async (source, end) => {
  const owner = { nativeSession: `${source}-ticket` } as AccountSession;
  const job: Job = { task_id: 1, kind: "mood_features", status: "running", source };
  const [jobs, setJobs] = createSignal<Job[]>([job]);
  const [playing, setPlaying] = createSignal(true);
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs,
      playing,
      sessions: { local: () => owner, server: () => owner },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(1);
  request.mockRejectedValue(new Error("Unavailable release"));
  if (end === "pause") setPlaying(false);
  else setJobs([]);
  await vi.advanceTimersByTimeAsync(10000);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: false }),
    source,
    owner,
  );
  expect(vi.getTimerCount()).toBe(0);
  request.mockResolvedValue({});
  if (end === "pause") setPlaying(true);
  else setJobs([job]);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: true }),
    source,
    owner,
  );
  await vi.advanceTimersByTimeAsync(2000);
  expect(request).toHaveBeenCalledTimes(4);
  dispose();
  await vi.advanceTimersByTimeAsync(10000);
  expect(request).toHaveBeenCalledTimes(4);
});

it("renews a resumed target even when its pending release fails", async () => {
  const owner = { nativeSession: "server-ticket" } as AccountSession;
  const [playing, setPlaying] = createSignal(true);
  let reject!: (error: Error) => void;
  const release = new Promise((_resolve, fail) => {
    reject = fail;
  });
  createRoot((clean) => {
    dispose = clean;
    createBackgroundPriority({
      jobs: () => [{ task_id: 1, kind: "mood_features", status: "running", source: "server" }],
      playing,
      sessions: { local: () => undefined, server: () => owner },
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  request.mockImplementationOnce(() => release);
  setPlaying(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(2);
  setPlaying(true);
  reject(new Error("Release unavailable"));
  await vi.advanceTimersByTimeAsync(2000);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: true }),
    "server",
    owner,
  );
  setPlaying(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledTimes(4);
  expect(request).toHaveBeenLastCalledWith(
    "/api/me/v1/background-priority",
    {},
    "POST",
    expect.objectContaining({ active: false }),
    "server",
    owner,
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect(request).toHaveBeenCalledTimes(4);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([
  ["local", "replacement"],
  ["server", "replacement"],
  ["local", "relogin"],
  ["server", "relogin"],
  ["local", "round-trip"],
  ["server", "round-trip"],
] as const)(
  "admits fresh %s priority after %s without waiting for its retired request",
  async (source, change) => {
    const original = {
      nativeSession: "old-ticket",
      account: { id: "same-owner" },
    } as AccountSession;
    const next =
      change === "round-trip"
        ? original
        : {
            ...original,
            nativeSession: "new-ticket",
            account: {
              ...original.account,
              id: change === "replacement" ? "other-owner" : "same-owner",
            },
          };
    const [session, setSession] = createSignal<AccountSession | undefined>(original);
    const job: Job = { task_id: 1, kind: "mood_features", status: "running", source };
    const [jobs, setJobs] = createSignal<Job[]>([job]);
    const [playing, setPlaying] = createSignal(true);
    let finish!: () => void, fail!: (error: Error) => void;
    const oldReply = new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    request.mockImplementationOnce(() => oldReply);
    createRoot((clean) => {
      dispose = clean;
      createBackgroundPriority({
        jobs,
        playing,
        sessions: {
          local: () => (source === "local" ? session() : undefined),
          server: () => (source === "server" ? session() : undefined),
        },
      });
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(request).toHaveBeenCalledTimes(1);
      setJobs([]);
      setSession(undefined);
      setSession(next);
      setJobs([{ ...job, task_id: 2 }]);
      await vi.advanceTimersByTimeAsync(0);
      expect(request).toHaveBeenCalledTimes(2);
      const firstKey = (request.mock.calls[0]?.[3] as { client: string } | undefined)?.client;
      const nextKey = (request.mock.calls[1]?.[3] as { client: string } | undefined)?.client;
      expect(firstKey).toEqual(expect.any(String));
      expect(nextKey).toEqual(expect.any(String));
      expect(nextKey).not.toBe(firstKey);
      await vi.advanceTimersByTimeAsync(6000);
      expect(request).toHaveBeenCalledTimes(5);
      expect(
        request.mock.calls
          .slice(1)
          .every((call) => call[5] === next && (call[3] as { client: string }).client === nextKey),
      ).toBe(true);
      setPlaying(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(request).toHaveBeenCalledTimes(6);
      expect(request).toHaveBeenLastCalledWith(
        "/api/me/v1/background-priority",
        {},
        "POST",
        { client: nextKey, active: false },
        source,
        next,
      );
      if (change === "replacement") fail(new Error("Retired request failed"));
      else finish();
      await vi.advanceTimersByTimeAsync(10000);
      expect(request).toHaveBeenCalledTimes(6);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      dispose();
      finish();
    }
  },
);
