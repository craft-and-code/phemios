import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createJobs } from "./jobs";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
const owner: AccountSession = {
  server: "https://music.example",
  account: { id: "a", username: "a", role: "admin" },
};
let dispose: () => void;
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
it("resumes tracking after cancelling a check whose progress read failed", async () => {
  request.mockRejectedValueOnce(new Error("Temporary transport failure"));
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]?.tracking_error).toBe("Temporary transport failure");
  expect(vi.getTimerCount()).toBe(0);
  request
    .mockResolvedValueOnce({ status: "cancel_requested" })
    .mockResolvedValueOnce({ task_id: 7, status: "cancelled" });
  await tasks.cancel(7, "server");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs()[0]?.status).toBe("cancelled");
  expect(tasks.jobs()[0]?.tracking_error).toBeUndefined();
  expect(tasks.error()).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});
it("removes the former account's diagnostic when that source changes owner", async () => {
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  request.mockResolvedValue({ capabilities: [] });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, { session: () => session(), changed: async () => {} });
  });
  await Promise.resolve();
  request.mockRejectedValue(new Error("Former account's task diagnostic"));
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.error()).toBe("Former account's task diagnostic");
  request.mockResolvedValue({ capabilities: [] });
  setSession({ ...owner, account: { ...owner.account, id: "b" } });
  expect(tasks.jobs()).toEqual([]);
  expect(tasks.error()).toBe("");
});

it("does not let a late cancellation response revive tracking in the replacement account", async () => {
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  request.mockResolvedValue({ capabilities: [] });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? session() : undefined),
      changed: async () => {},
    });
  });
  await Promise.resolve();
  request.mockRejectedValue(new Error("Old progress failed"));
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  let accept!: () => void;
  request.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        accept = resolve;
      }),
  );
  const cancelled = tasks.cancel(7, "server");
  expect(request.mock.calls.at(-1)?.[5]).toBe(owner);
  request.mockResolvedValue({ capabilities: [] });
  setSession({ ...owner, account: { ...owner.account, id: "b" } });
  tasks.track({ task_id: 7 }, "check", "server", "release:other");
  request.mockRejectedValue(new Error("New progress failed"));
  await vi.advanceTimersByTimeAsync(300);
  accept();
  await cancelled;
  expect(tasks.jobs()[0]?.tracking_error).toBe("New progress failed");
  expect(tasks.error()).toBe("New progress failed");
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps a local diagnostic when only the server account is replaced", async () => {
  const local = { ...owner, server: "https://local.example" };
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  request.mockResolvedValue({ capabilities: [] });
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: (source) => (source === "server" ? session() : local),
      changed: async () => {},
    });
  });
  await Promise.resolve();
  request.mockRejectedValue(new Error("Local progress failed"));
  tasks.track({ task_id: 7 }, "check", "local", "release:@phemios/local/fixture");
  await vi.advanceTimersByTimeAsync(300);
  request.mockResolvedValue({ capabilities: [] });
  setSession({ ...owner, account: { ...owner.account, id: "b" } });
  expect(tasks.jobs()).toHaveLength(1);
  expect(tasks.error()).toBe("Local progress failed");
});
it("keeps an unsuccessful cancellation retryable without claiming that work stopped", async () => {
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  request.mockRejectedValueOnce(new Error("Progress failed"));
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  request.mockRejectedValueOnce(new Error("Cancellation refused"));
  await expect(tasks.cancel(7, "server")).rejects.toThrow("Cancellation refused");
  expect(tasks.jobs()[0]).toMatchObject({ status: "queued", tracking_error: "Progress failed" });
  expect(vi.getTimerCount()).toBe(0);
  dispose();
  request.mockClear();
  await expect(tasks.cancel(7, "server")).rejects.toThrow("Session invalide");
  expect(request).not.toHaveBeenCalled();
});

it("clears a recovered terminal task diagnostic without needing another poll", async () => {
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  request.mockRejectedValueOnce(new Error("Temporary progress failure"));
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.error()).toBe("Temporary progress failure");
  request
    .mockResolvedValueOnce({ capabilities: ["administrative_tasks_list"] })
    .mockResolvedValueOnce([{ task_id: 7, status: "cancelled" }]);
  await tasks.restore("server");
  expect(tasks.jobs()[0]?.status).toBe("cancelled");
  expect(tasks.jobs()[0]?.tracking_error).toBeUndefined();
  expect(tasks.error()).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps recovered progress polling even if catalog synchronization fails", async () => {
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true, {
      session: () => undefined,
      changed: async () => {
        throw new Error("Catalog unavailable");
      },
    });
  });
  request.mockRejectedValue(new Error("Progress unavailable"));
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  tasks.track({ task_id: 8 }, "fetch", "server");
  await vi.advanceTimersByTimeAsync(300);
  expect(vi.getTimerCount()).toBe(0);
  request.mockImplementation(async (path) =>
    path === "/api/v1/status"
      ? { capabilities: ["administrative_tasks_list"] }
      : path === "/api/admin/v1/tasks"
        ? [
            { task_id: 7, status: "running" },
            { task_id: 8, status: "completed" },
          ]
        : { task_id: 7, status: "cancelled" },
  );
  await tasks.restore("server");
  expect(tasks.error()).toContain("Catalog unavailable");
  await vi.advanceTimersByTimeAsync(300);
  expect(tasks.jobs().find((row) => row.task_id === 7)?.status).toBe("cancelled");
  expect(tasks.error()).toContain("Catalog unavailable");
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps a newer independent error when an older successful recovery completes", async () => {
  const tasks = createRoot((end) => {
    dispose = end;
    return createJobs(() => true);
  });
  request.mockRejectedValueOnce(new Error("Server read failed"));
  tasks.track({ task_id: 7 }, "check", "server", "release:fixture");
  await vi.advanceTimersByTimeAsync(300);
  let accept!: (value: unknown) => void;
  request
    .mockResolvedValueOnce({ capabilities: ["administrative_tasks_list"] })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
  const restored = tasks.restore("server");
  for (let i = 0; i < 12; i++) await Promise.resolve();
  request.mockRejectedValueOnce(new Error("Local read failed"));
  tasks.track({ task_id: 8 }, "check", "local", "release:@phemios/local/fixture");
  await vi.advanceTimersByTimeAsync(300);
  accept([{ task_id: 7, status: "cancelled" }]);
  await restored;
  expect(tasks.error()).toBe("Local read failed");
  expect(tasks.jobs().find((row) => row.source === "local")?.tracking_error).toBe(
    "Local read failed",
  );
  expect(vi.getTimerCount()).toBe(0);
});
