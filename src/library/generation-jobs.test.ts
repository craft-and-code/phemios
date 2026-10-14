import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGenerations } from "./generation-jobs";
import {
  generationForJob,
  administrativeWorkActive,
  validGenerationSteps,
} from "./generation-policy";
import { requestAede } from "../platform/desktop";
import type { AccountSession } from "./server";
import type { Job } from "./jobs";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const request = vi.mocked(requestAede);
const owner = {
  server: "http://localhost:8787",
  account: { id: "alice", username: "alice", role: "admin" },
  nativeSession: "session-one",
} as AccountSession;
let dispose: () => void;
function setup(rows: readonly Job[] = []) {
  return createRoot((cleanup) => {
    dispose = cleanup;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    const accepted = vi.fn();
    const tasks = createGenerations({ jobs: () => rows, session, accepted });
    return { tasks, setSession, accepted };
  });
}
beforeEach(() => request.mockReset());
afterEach(() => dispose?.());
it("keeps the exact ordered plan on one source and hands its task to background tracking", async () => {
  const view = setup();
  request
    .mockResolvedValueOnce({ capabilities: ["library_generations"] })
    .mockResolvedValueOnce({ task_id: 7, status: "queued" });
  expect(await view.tasks.start("local", ["analyze", "spectrum", "m3u", "lyrics"])).toBe(7);
  expect(request).toHaveBeenLastCalledWith(
    "/api/admin/v1/generate",
    {},
    "POST",
    { steps: ["analyze", "spectrum", "m3u", "lyrics"] },
    "local",
    owner,
  );
  expect(view.accepted).toHaveBeenCalledWith(
    { task_id: 7, status: "queued" },
    "generate_all",
    "local",
  );
  expect(view.tasks.pending()).toBeUndefined();
});
it("refuses a duplicate submission while capability admission is still pending", async () => {
  const view = setup();
  let done!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise((resolve) => (done = resolve)));
  const first = view.tasks.start("server", ["m3u"]);
  await expect(view.tasks.start("server", ["lyrics"])).rejects.toThrow(/déjà actif/);
  done({ capabilities: ["library_generations"] });
  request.mockResolvedValueOnce({ task_id: 1, status: "queued" });
  await first;
  expect(request.mock.calls.filter((call) => call[0].endsWith("/generate"))).toHaveLength(1);
});
it("never starts a generation after the captured account is replaced", async () => {
  const view = setup();
  let done!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise((resolve) => (done = resolve)));
  const first = view.tasks.start("server", ["m3u"]);
  view.setSession({ ...owner, nativeSession: "another-login" });
  done({ capabilities: ["library_generations"] });
  await expect(first).rejects.toThrow(/Session invalide/);
  expect(request.mock.calls.filter((call) => call[0].endsWith("/generate"))).toHaveLength(0);
  expect(view.accepted).not.toHaveBeenCalled();
});
it("refuses unknown plans, unsupported servers and nonadministrative accounts before work", async () => {
  const view = setup();
  await expect(view.tasks.start("server", ["m3u", "m3u"])).rejects.toThrow(/invalide/);
  request.mockResolvedValueOnce({ capabilities: [] });
  await expect(view.tasks.start("server", ["m3u"])).rejects.toThrow(/redémarrez/);
  view.setSession({ ...owner, account: { ...owner.account, role: "user" } });
  await expect(view.tasks.start("server", ["m3u"])).rejects.toThrow(/administrateur/);
  expect(view.accepted).not.toHaveBeenCalled();
});
it("keeps admission reserved even when tracking of another administrative task failed", async () => {
  const rows: Job[] = [
    { task_id: 1, status: "running", source: "server", kind: "analyze", tracking_error: "lost" },
  ];
  expect(administrativeWorkActive(rows)).toBe(true);
  const view = setup(rows);
  await expect(view.tasks.start("local", ["m3u"])).rejects.toThrow(/déjà actif/);
  expect(request).not.toHaveBeenCalled();
});
it("restores the exact single action or whole-plan loader from server task kinds", () => {
  expect(
    generationForJob({ task_id: 1, status: "running", task_kind: "library_generation_m3u" }),
  ).toBe("m3u");
  expect(generationForJob({ task_id: 1, status: "running", task_kind: "library_generation" })).toBe(
    "all",
  );
  expect(
    generationForJob({ task_id: 1, status: "running", task_kind: "analysis" }),
  ).toBeUndefined();
  expect(generationForJob({ task_id: 1, status: "running", kind: "analyze" })).toBeUndefined();
  expect(validGenerationSteps([])).toBe(false);
  expect(validGenerationSteps(["shell"])).toBe(false);
});
