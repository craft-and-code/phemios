import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connectionMonitor } from "./connection";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it("stays offline without a session and detects loss and recovery without overlapping probes", async () => {
  const probe = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(undefined);
  const changed = vi.fn(),
    monitor = connectionMonitor(probe, changed);
  await vi.advanceTimersByTimeAsync(30000);
  expect(probe).not.toHaveBeenCalled();
  monitor.start();
  expect(changed).toHaveBeenLastCalledWith(true);
  await vi.advanceTimersByTimeAsync(15000);
  expect(changed).toHaveBeenLastCalledWith(false);
  await vi.advanceTimersByTimeAsync(15000);
  expect(changed).toHaveBeenLastCalledWith(true);
  monitor.stop();
  await vi.advanceTimersByTimeAsync(30000);
  expect(probe).toHaveBeenCalledTimes(2);
  expect(changed).toHaveBeenLastCalledWith(false);
});
it("ignores an old session's late heartbeat and waits for a pending probe", async () => {
  let resolve!: () => void;
  const probe = vi.fn().mockReturnValue(
    new Promise<void>((yes) => {
      resolve = yes;
    }),
  );
  const changed = vi.fn(),
    monitor = connectionMonitor(probe, changed);
  monitor.start();
  await vi.advanceTimersByTimeAsync(60000);
  expect(probe).toHaveBeenCalledOnce();
  monitor.stop();
  resolve();
  await Promise.resolve();
  expect(changed).toHaveBeenLastCalledWith(false);
  expect(vi.getTimerCount()).toBe(0);
});
