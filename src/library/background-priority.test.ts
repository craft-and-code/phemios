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
    createBackgroundPriority({ jobs, playing, session: () => owner });
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
      session: () => ({}) as AccountSession,
    });
  });
  await vi.advanceTimersByTimeAsync(0);
  dispose();
  await vi.advanceTimersByTimeAsync(10000);
  expect(request).toHaveBeenCalledTimes(1);
});
