import { createRoot } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { activeReleaseJob, createJobs } from "./jobs";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
let dispose: () => void;
function controller(connected = () => true) {
  return createRoot((cleanup) => {
    dispose = cleanup;
    return createJobs(connected);
  });
}
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
it("retains release and task kind while polling server completion", async () => {
  request.mockResolvedValueOnce({ task_id: 1, status: "queued" }).mockResolvedValueOnce({
    task_id: 1,
    status: "completed",
    task_kind: "analysis",
    result: { exit_code: 0, stdout: "ok", stderr: "", output_truncated: false },
  });
  const tasks = controller();
  await tasks.start("analyze", "release:one", false);
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]).toMatchObject({
    release: "release:one",
    kind: "analyze",
    status: "completed",
    result: { exit_code: 0 },
  });
  expect(request).toHaveBeenNthCalledWith(1, "/api/admin/v1/analyze", {}, "POST", {
    release: "release:one",
    force: false,
    threads: 2,
  });
  expect(vi.getTimerCount()).toBe(0);
});
it("limits explicitly started active tasks and does not silently start a fifth", async () => {
  let id = 0;
  request.mockImplementation(async () => ({ task_id: ++id, status: "queued" }));
  const tasks = controller();
  for (let i = 0; i < 4; i++) await tasks.start("spectrum", "release:one", true);
  await expect(tasks.start("spectrum", "release:one", true)).rejects.toThrow("Quatre tâches");
  expect(request).toHaveBeenCalledTimes(4);
});
it("stops network polling when disconnected and surfaces server errors", async () => {
  let connected = true;
  request
    .mockResolvedValueOnce({ task_id: 9, status: "queued" })
    .mockRejectedValueOnce(new Error("Session expirée"));
  const tasks = controller(() => connected);
  await tasks.start("analyze", "release:one", false);
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.error()).toBe("Session expirée");
  connected = false;
  await vi.advanceTimersByTimeAsync(1200);
  expect(request).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("shows activity only for queued or running work on the matching source release", () => {
  const rows = [
    { task_id: 1, status: "completed" as const, release: "release:a" },
    { task_id: 2, status: "queued" as const, release: "release:b" },
    { task_id: 3, status: "running" as const, release: "release:a", source: "server" as const },
    {
      task_id: 4,
      status: "queued" as const,
      release: "release:@phemios/local/a",
      source: "local" as const,
    },
  ];
  expect(activeReleaseJob(rows, "release:a")?.task_id).toBe(3);
  expect(activeReleaseJob(rows, "release:b")?.task_id).toBe(2);
  expect(activeReleaseJob(rows, "release:@phemios/local/a")?.task_id).toBe(4);
  expect(
    activeReleaseJob(
      rows.filter((row) => row.status === "completed"),
      "release:a",
    ),
  ).toBeUndefined();
});

it("restores actual running enrichment jobs and syncs confirmed completion without replaying a fetch", async () => {
  const changed = vi.fn(async () => {}),
    session = {
      server: "http://localhost:3412",
      account: { id: "owner", username: "owner", role: "admin" as const },
    };
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["administrative_tasks_list"] }
      : path === "/api/admin/v1/tasks"
        ? [{ task_id: 7, task_kind: "identification", status: "running" }]
        : {
            task_id: 7,
            status: "completed",
            result: {
              exit_code: 0,
              stdout: "Retained biography",
              stderr: "",
              output_truncated: false,
            },
          },
  );
  const jobs = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? session : undefined),
      changed,
    });
  });
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(jobs.jobs()[0]?.kind).toBe("fetch");
  await vi.advanceTimersByTimeAsync(300);
  expect(jobs.jobs()[0]?.status).toBe("completed");
  expect(changed).toHaveBeenCalledWith("server");
  expect(request.mock.calls.some((call) => call[0] === "/api/admin/v1/fetch")).toBe(false);
});

it("keeps a newly accepted task when an older restore response arrives", async () => {
  const jobs = controller();
  let finish!: (v: unknown) => void;
  request
    .mockResolvedValueOnce({ capabilities: ["administrative_tasks_list"] })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const restore = jobs.restore("server");
  await Promise.resolve();
  await Promise.resolve();
  jobs.track({ task_id: 12 }, "fetch", "server");
  finish([]);
  await restore;
  expect(jobs.jobs()[0]?.task_id).toBe(12);
});

it("keeps enrichment submission shared across view changes and blocks duplicates through server completion", async () => {
  let accept!: (value: unknown) => void;
  request.mockImplementation(async (path) => {
    if (path === "/api/v1/status") return { capabilities: ["fetch_musicbrainz_first"] };
    if (path === "/api/admin/v1/fetch")
      return new Promise((resolve) => {
        accept = resolve;
      });
    return { task_id: 11, status: "completed" };
  });
  const tasks = controller();
  const started = tasks.enrich(["server"], { musicbrainz: true });
  expect(tasks.enrichmentPending()).toBe(true);
  expect(await tasks.enrich(["server"], { musicbrainz: true })).toBeUndefined();
  for (let i = 0; i < 6; i++) await Promise.resolve();
  accept({ task_id: 11 });
  await started;
  expect(tasks.enrichmentPending()).toBe(false);
  expect(tasks.jobs()[0]).toMatchObject({ task_id: 11, kind: "fetch", status: "queued" });
  expect(await tasks.enrich(["server"], { musicbrainz: true })).toBeUndefined();
  expect(request.mock.calls.filter(([path]) => path === "/api/admin/v1/fetch")).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]?.status).toBe("completed");
});

it("resumes a failed task tracker from the confirmed server list without launching work again", async () => {
  const changed = vi.fn(async () => {});
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, { session: () => undefined, changed });
  });
  request.mockRejectedValueOnce(new Error("Offline"));
  tasks.track({ task_id: 11 }, "fetch", "server");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]?.tracking_error).toBe("Offline");
  request
    .mockResolvedValueOnce({ capabilities: ["administrative_tasks_list"] })
    .mockResolvedValueOnce([{ task_id: 11, task_kind: "identification", status: "running" }])
    .mockResolvedValueOnce({ task_id: 11, status: "completed" });
  await tasks.restore("server");
  expect(tasks.jobs()[0]?.tracking_error).toBeUndefined();
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]?.status).toBe("completed");
  expect(changed).toHaveBeenCalledTimes(1);
  expect(request.mock.calls.every(([, , method]) => method === "GET")).toBe(true);
});
it("refreshes retained catalog data if retry discovers that enrichment already completed", async () => {
  const changed = vi.fn(async () => {});
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, { session: () => undefined, changed });
  });
  request.mockRejectedValueOnce(new Error("Offline"));
  tasks.track({ task_id: 11 }, "fetch", "server");
  await vi.advanceTimersByTimeAsync(300);
  request
    .mockResolvedValueOnce({ capabilities: ["administrative_tasks_list"] })
    .mockResolvedValueOnce([{ task_id: 11, task_kind: "identification", status: "completed" }]);
  await tasks.restore("server");
  expect(changed).toHaveBeenCalledTimes(1);
  expect(tasks.jobs()[0]?.status).toBe("completed");
  expect(tasks.jobs()[0]?.tracking_error).toBeUndefined();
});
it("starts one scoped acoustic task and refuses a duplicate while it runs", async () => {
  request.mockResolvedValue({ task_id: 19, status: "queued" });
  const tasks = controller();
  await tasks.features("local");
  expect(request).toHaveBeenCalledWith(
    "/api/admin/v1/mood-features",
    {},
    "POST",
    { force: false },
    "local",
  );
  expect(tasks.jobs()[0]).toMatchObject({ kind: "mood_features", source: "local", task_id: 19 });
  await expect(tasks.features("local")).rejects.toThrow();
});

it("cancels with the empty-body administrative contract", async () => {
  request.mockResolvedValue({});
  const tasks = controller();
  await tasks.cancel(19, "local");
  expect(request).toHaveBeenCalledWith("/api/admin/v1/tasks/19/cancel", {}, "POST", null, "local");
});

it("album integrity binds the capability read and exact mutation to the captured local owner", async () => {
  const owner = { account: { role: "admin" } } as import("./server").AccountSession;
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["album_decode_test"] }
      : { task_id: 7, status: "queued" },
  );
  const tasks = createRoot((cleanup) => {
    dispose = cleanup;
    return createJobs(() => true, { session: () => owner, changed: async () => {} });
  });
  await tasks.start("check", "release:@phemios/local/fixture", true);
  expect(request).toHaveBeenCalledWith(
    "/api/admin/v1/check",
    {},
    "POST",
    { release: "release:@phemios/local/fixture" },
    "local",
    owner,
  );
  expect(tasks.jobs().find((row) => row.task_id === 7)?.kind).toBe("check");
});
