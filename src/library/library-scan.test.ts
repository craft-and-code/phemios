import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createLibraryScan } from "./library-scan";
import { createJobs } from "./jobs";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
let dispose: () => void;
afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
  request.mockReset();
});
it("cancels an admitted library scan using the server's empty-body contract", async () => {
  vi.stubGlobal("window", {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  const owner: AccountSession = {
    server: "https://music.example",
    account: { id: "a", username: "a", role: "admin" },
  };
  request.mockImplementation(async (_path, _query, method, body) => {
    if (method === "POST" && body !== null)
      throw new Error("Task cancellation requires an empty body");
    return { capabilities: [] };
  });
  const scan = createRoot((end) => {
    dispose = end;
    const tasks = createJobs(() => true, { session: () => owner, changed: async () => {} });
    return createLibraryScan({ session: () => owner, tasks });
  });
  await scan.start("server", async () => ({ task_id: 7, status: "queued" }));
  await expect(scan.cancel()).resolves.toBeUndefined();
  expect(request).toHaveBeenCalledWith(
    "/api/admin/v1/tasks/7/cancel",
    {},
    "POST",
    null,
    "server",
    owner,
  );
});

const admin: AccountSession = {
  server: "https://music.example",
  account: { id: "a", username: "a", role: "admin" },
};
function projection() {
  return createRoot((end) => {
    dispose = end;
    const [session, setSession] = createSignal<AccountSession | undefined>(admin);
    const tasks = {
      jobs: () => [
        { task_id: 7, source: "server" as const, kind: "scan", status: "running" as const },
      ],
      track: vi.fn(),
      restore: vi.fn(async () => {}),
      cancel: vi.fn(async () => {}),
    };
    const scan = createLibraryScan({ session, tasks });
    return { scan, tasks, setSession };
  });
}
it("hides a selected scan and prevents actions after switching accounts", async () => {
  const { scan, tasks, setSession } = projection();
  await scan.start("server", async () => ({ task_id: 7, status: "queued" }));
  expect(scan.task()?.task_id).toBe(7);
  setSession({ ...admin, account: { ...admin.account, id: "b" } });
  expect(scan.task()).toBeUndefined();
  await scan.cancel();
  await scan.refresh();
  expect(tasks.cancel).not.toHaveBeenCalled();
  expect(tasks.restore).not.toHaveBeenCalled();
});
it("ignores admission completed after logout and re-login with the same account object", async () => {
  const { scan, tasks, setSession } = projection();
  let resolve!: (value: { task_id: number; status: "queued" }) => void;
  const admitted = scan.start(
    "server",
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  setSession(undefined);
  setSession(admin);
  resolve({ task_id: 7, status: "queued" });
  expect(await admitted).toBe(false);
  expect(tasks.track).not.toHaveBeenCalled();
});
it("does not adopt a late admission after the settings view is disposed", async () => {
  const { scan, tasks } = projection();
  let resolve!: (value: { task_id: number; status: "queued" }) => void;
  const admitted = scan.start(
    "server",
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  dispose();
  resolve({ task_id: 7, status: "queued" });
  expect(await admitted).toBe(false);
  expect(tasks.track).not.toHaveBeenCalled();
});
for (const mode of ["poll", "restore"] as const) {
  it(`refreshes the catalogue after a scan completes through ${mode}`, async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const completed = { task_id: 7, status: "completed", task_kind: "scan" };
    request.mockImplementation(async (path) =>
      path === "/api/v1/status"
        ? { capabilities: ["administrative_tasks_list"] }
        : path === "/api/admin/v1/tasks"
          ? [completed]
          : completed,
    );
    const changed = vi.fn(async () => {});
    const tasks = createRoot((end) => {
      dispose = end;
      return createJobs(() => true, { changed, session: () => undefined });
    });
    try {
      tasks.track({ task_id: 7 }, "scan", "server");
      if (mode === "poll") await vi.advanceTimersByTimeAsync(300);
      else await tasks.restore("server");
      expect(changed).toHaveBeenCalledWith("server");
      expect(tasks.jobs()[0]?.status).toBe("completed");
    } finally {
      dispose();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
}
