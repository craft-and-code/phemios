import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createJobs, type Job } from "./jobs";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
let dispose: () => void;
const settle = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}
const partial = (count: number): NonNullable<Job["result"]> => ({
  exit_code: 0,
  stderr: "",
  output_truncated: false,
  stdout: JSON.stringify({
    version: 1,
    files: Array.from({ length: count }, (_, index) => ({
      path: `/fixture/${index}.flac`,
      status: "ok",
      verifier: "Rust",
    })),
  }),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
});
afterEach(() => {
  dispose?.();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  request.mockReset();
});
it("does not let an older recovery snapshot erase newer completed-file progress", async () => {
  const recovered = deferred<Job[]>();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["administrative_tasks_list"] }
      : path === "/api/admin/v1/tasks"
        ? recovered.promise
        : { task_id: 7, status: "running", partial_result: partial(2) },
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  const restore = tasks.restore("server");
  await settle();
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]?.partial_result).toEqual(partial(2));
  recovered.resolve([{ task_id: 7, status: "running", partial_result: partial(1) }]);
  await restore;
  expect(tasks.jobs()[0]?.partial_result).toEqual(partial(2));
});
it("does not apply an older poll after a newer recovery confirmed cancellation", async () => {
  const polled = deferred<Job>();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["administrative_tasks_list"] }
      : path === "/api/admin/v1/tasks"
        ? [{ task_id: 7, status: "cancelled", partial_result: partial(2) }]
        : polled.promise,
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  await tasks.restore("server");
  polled.resolve({ task_id: 7, status: "running", partial_result: partial(1) });
  await settle();
  expect(tasks.jobs()[0]?.status).toBe("cancelled");
  expect(tasks.jobs()[0]?.partial_result).toEqual(partial(2));
  expect(vi.getTimerCount()).toBe(0);
});
it("stops the old polling batch before dispatching another task after account replacement", async () => {
  const polled = deferred<Job>();
  const owner: AccountSession = {
    server: "https://music.example",
    account: { id: "admin", username: "admin", role: "admin" },
  };
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  request.mockImplementation(async (path) =>
    path === "/api/v1/status" ? { capabilities: [] } : polled.promise,
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? session() : undefined),
      changed: async () => {},
    });
  });
  await settle();
  request.mockClear();
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  tasks.track({ task_id: 8 }, "check", "server", "release:other");
  await vi.advanceTimersByTimeAsync(300);
  setSession({ ...owner, account: { id: "reader", username: "reader", role: "user" } });
  polled.resolve({ task_id: 7, status: "running", partial_result: partial(1) });
  await settle();
  expect(request.mock.calls.map(([path]) => path)).toEqual(["/api/admin/v1/tasks/7"]);
  expect(tasks.jobs()).toEqual([]);
});
it("does not submit an album check after the jobs owner is disposed during admission", async () => {
  const capability = deferred<unknown>();
  const owner = {
    server: "https://music.example",
    account: { id: "admin", username: "admin", role: "admin" },
  } as AccountSession;
  request.mockResolvedValue({ capabilities: [] });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? owner : undefined),
      changed: async () => {},
    });
  });
  await settle();
  request.mockClear();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status" ? capability.promise : { task_id: 7, status: "queued" },
  );
  const started = tasks.start("check", "release:fixture", true);
  dispose();
  capability.resolve({ capabilities: ["album_decode_results"] });
  await expect(started).rejects.toThrow();
  expect(request.mock.calls.some((call) => call[2] === "POST")).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not restart a timer when old recovery says running after completion was polled", async () => {
  const recovered = deferred<Job[]>();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["administrative_tasks_list"] }
      : path === "/api/admin/v1/tasks"
        ? recovered.promise
        : { task_id: 7, status: "completed" },
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  const restoring = tasks.restore("server");
  await settle();
  await vi.advanceTimersByTimeAsync(300);
  recovered.resolve([{ task_id: 7, status: "running", partial_result: partial(1) }]);
  await restoring;
  expect(tasks.jobs()[0]?.status).toBe("completed");
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps a catalog refresh failure visible after publishing a completed task", async () => {
  request.mockResolvedValue({ task_id: 7, status: "completed" });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: () => undefined,
      changed: async () => {
        throw new Error("Refresh unavailable");
      },
    });
  });
  tasks.track({ task_id: 7 }, "fetch", "server");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.error()).toBe("Refresh unavailable");
  expect(tasks.jobs()[0]?.tracking_error).toBe("Refresh unavailable");
});
it("rejects late admission after leaving and returning to the very same account object", async () => {
  const owner = {
    server: "https://music.example",
    account: { id: "admin", username: "admin", role: "admin" },
  } as AccountSession;
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  request.mockResolvedValue({ capabilities: [] });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? session() : undefined),
      changed: async () => {},
    });
  });
  await settle();
  const capability = deferred<unknown>();
  request.mockImplementation(async () => capability.promise);
  const started = tasks.start("check", "release:fixture", true);
  setSession(undefined);
  setSession(owner);
  capability.resolve({ capabilities: ["album_decode_results"] });
  await expect(started).rejects.toThrow("Session invalide");
  expect(request.mock.calls.some((call) => call[2] === "POST")).toBe(false);
});
it("does not rearm polling after disposal while a request is in flight", async () => {
  const polled = deferred<Job>();
  request.mockImplementation(async () => polled.promise);
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  dispose();
  polled.resolve({ task_id: 7, status: "running", partial_result: partial(1) });
  await settle();
  expect(vi.getTimerCount()).toBe(0);
});

it("continues a local task without reading another old server task after account replacement", async () => {
  const owner = {
    server: "https://music.example",
    account: { id: "admin", username: "admin", role: "admin" },
  } as AccountSession;
  const localOwner = { ...owner, server: "https://local.example" };
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  const polled = deferred<Job>();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: [] }
      : path === "/api/admin/v1/tasks/7"
        ? polled.promise
        : { task_id: 8, status: "completed" },
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? session() : localOwner),
      changed: async () => {},
    });
  });
  await settle();
  request.mockClear();
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  tasks.track({ task_id: 8 }, "check", "local", "release:@phemios/local/fixture");
  await vi.advanceTimersByTimeAsync(300);
  setSession(undefined);
  polled.resolve({ task_id: 7, status: "running" });
  await settle();
  expect(tasks.jobs()).toMatchObject([{ task_id: 8, source: "local", status: "completed" }]);
  expect(request.mock.calls[1]?.[4]).toBe("local");
  expect(request.mock.calls[1]?.[5]).toBe(localOwner);
});
it("ignores an old poll error after recovery has confirmed cancellation", async () => {
  const polled = deferred<Job>();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["administrative_tasks_list"] }
      : path === "/api/admin/v1/tasks"
        ? [{ task_id: 7, status: "cancelled", partial_result: partial(1) }]
        : polled.promise,
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  await tasks.restore("server");
  polled.reject(new Error("Old transport error"));
  await settle();
  expect(tasks.jobs()[0]?.status).toBe("cancelled");
  expect(tasks.jobs()[0]?.tracking_error).toBeUndefined();
  expect(tasks.error()).toBe("");
});
it("does not retain a late accepted task after disposal while submission is pending", async () => {
  const owner = {
    server: "https://music.example",
    account: { id: "admin", username: "admin", role: "admin" },
  } as AccountSession;
  request.mockResolvedValue({ capabilities: [] });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? owner : undefined),
      changed: async () => {},
    });
  });
  await settle();
  const accepted = deferred<unknown>();
  request.mockImplementation(async (path) =>
    path === "/api/v1/status" ? { capabilities: ["album_decode_results"] } : accepted.promise,
  );
  const started = tasks.start("check", "release:fixture", true);
  await settle();
  dispose();
  accepted.resolve({ task_id: 7, status: "queued" });
  await expect(started).rejects.toThrow("Session invalide");
  expect(tasks.jobs()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["poll", "restore"] as const)(
  "drops the duplicated intermediate JSON after final completion through %s",
  async (method) => {
    let completed = false;
    request.mockImplementation(async (path) =>
      path === "/api/v1/status"
        ? { capabilities: ["administrative_tasks_list"] }
        : path === "/api/admin/v1/tasks"
          ? [{ task_id: 7, status: "completed", result: partial(2) }]
          : completed
            ? { task_id: 7, status: "completed", result: partial(2) }
            : { task_id: 7, status: "running", partial_result: partial(2) },
    );
    const tasks = createRoot((end) => {
      dispose = end;
      return createJobs(() => true);
    });
    tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
    await vi.advanceTimersByTimeAsync(300);
    expect(tasks.jobs()[0]?.partial_result).toBeDefined();
    completed = true;
    if (method === "poll") await vi.advanceTimersByTimeAsync(1200);
    else await tasks.restore("server");
    expect(tasks.jobs()[0]?.status).toBe("completed");
    expect(tasks.jobs()[0]?.result).toEqual(partial(2));
    expect(tasks.jobs()[0]?.partial_result).toBeUndefined();
  },
);

it("keeps reading independent checks while completed-job catalog synchronization is pending", async () => {
  const refreshed = deferred<void>();
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, { session: () => undefined, changed: () => refreshed.promise });
  });
  let finished = false;
  request.mockImplementation(async (path) =>
    path.endsWith("/7")
      ? { task_id: 7, status: "completed" }
      : {
          task_id: 8,
          status: finished ? "completed" : "running",
          ...(finished ? { result: partial(2) } : { partial_result: partial(1) }),
        },
  );
  tasks.track({ task_id: 7 }, "fetch", "server");
  tasks.track({ task_id: 8 }, "check", "local", "release:@phemios/local/fixture");
  try {
    await vi.advanceTimersByTimeAsync(300);
    expect(tasks.jobs().find((row) => row.task_id === 8)?.partial_result).toEqual(partial(1));
    finished = true;
    await vi.advanceTimersByTimeAsync(1200);
    expect(tasks.jobs().find((row) => row.task_id === 8)?.status).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    refreshed.resolve();
    await settle();
  }
});

it.each(["account", "dispose"] as const)(
  "ignores a detached catalog refresh failure after %s retirement",
  async (retirement) => {
    const refreshed = deferred<void>();
    const owner = {
      server: "https://music.example",
      account: { id: "a", username: "a", role: "admin" },
    } as AccountSession;
    const localOwner = { ...owner, server: "https://local.example" };
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    request.mockImplementation(async (path) =>
      path === "/api/v1/status" ? { capabilities: [] } : { task_id: 7, status: "completed" },
    );
    const tasks = createRoot((end) => {
      dispose = end;
      return createJobs(() => true, {
        session: (source) => (source === "server" ? session() : localOwner),
        changed: () => refreshed.promise,
      });
    });
    await settle();
    tasks.track({ task_id: 7 }, "fetch", "server");
    await vi.advanceTimersByTimeAsync(300);
    if (retirement === "dispose") dispose();
    else setSession({ ...owner, account: { ...owner.account, id: "b" } });
    refreshed.reject(new Error("Previous owner's refresh failure"));
    await settle();
    expect(tasks.error()).toBe("");
    expect(tasks.jobs().some((row) => row.tracking_error)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each([
  ["server", "local"],
  ["server", "server", "server"],
] as const)(
  "serializes completed-job refreshes and coalesces queued source reads: %j",
  async (...sources) => {
    const refreshed = deferred<void>();
    const changed = vi.fn((_source: string) =>
      changed.mock.calls.length === 1 ? refreshed.promise : Promise.resolve(),
    );
    const tasks = createRoot((end) => {
      dispose = end;
      return createJobs(() => true, { session: () => undefined, changed });
    });
    request.mockImplementation(async (path) => ({
      task_id: Number(path.split("/").at(-1)),
      status: "completed",
    }));
    for (const [index, source] of sources.entries())
      tasks.track({ task_id: index + 1 }, "fetch", source);
    await vi.advanceTimersByTimeAsync(300);
    expect(tasks.jobs().every((row) => row.status === "completed")).toBe(true);
    expect(changed.mock.calls.map(([source]) => source)).toEqual([sources[0]]);
    refreshed.resolve();
    await settle();
    expect(changed.mock.calls.map(([source]) => source)).toEqual([sources[0], sources[1]]);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("never dispatches a queued refresh from an earlier login after returning to the same account object", async () => {
  const blocked = deferred<void>();
  const owner = {
    server: "https://music.example",
    account: { id: "a", username: "a", role: "admin" },
  } as AccountSession;
  const local = { ...owner, server: "https://local.example" };
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  const changed = vi.fn(async (source: string) => {
    if (source === "local") await blocked.promise;
  });
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: [] }
      : { task_id: Number(path.split("/").at(-1)), status: "completed" },
  );
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "local" ? local : session()),
      changed,
    });
  });
  await settle();
  tasks.track({ task_id: 1 }, "fetch", "local");
  tasks.track({ task_id: 2 }, "fetch", "server");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs().every((row) => row.status === "completed")).toBe(true);
  setSession(undefined);
  setSession(owner);
  blocked.resolve();
  await settle();
  expect(changed.mock.calls).toEqual([["local"]]);
  expect(tasks.error()).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});
