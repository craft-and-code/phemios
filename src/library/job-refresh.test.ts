import { expect, it, vi } from "vitest";
import { createJobRefresh } from "./job-refresh";
function deferred() {
  let resolve!: () => void, reject!: (failure: Error) => void;
  const promise = new Promise<void>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}
it("discards an obsolete queued owner and reads once for its replacement", async () => {
  const blocked = deferred();
  const changed = vi.fn(async () => {
    if (changed.mock.calls.length === 1) await blocked.promise;
  });
  const refresh = createJobRefresh(changed);
  let oldOwner = true;
  const local = refresh.request("local", () => true);
  const oldServer = refresh.request("server", () => oldOwner);
  oldOwner = false;
  const newServer = refresh.request("server", () => true);
  expect(refresh.request("server", () => true)).toBe(newServer);
  await oldServer;
  expect(changed).toHaveBeenCalledTimes(1);
  blocked.resolve();
  await Promise.all([local, newServer]);
  expect(changed.mock.calls).toEqual([["local"], ["server"]]);
  refresh.dispose();
});
it("settles discarded work and never dispatches queued reads after disposal", async () => {
  const blocked = deferred();
  const changed = vi.fn(() => blocked.promise);
  const refresh = createJobRefresh(changed);
  const local = refresh.request("local", () => true);
  const server = refresh.request("server", () => true);
  refresh.dispose();
  await server;
  await refresh.request("server", () => true);
  blocked.resolve();
  await local;
  expect(changed).toHaveBeenCalledTimes(1);
});
it("continues another source after a failed read without replaying the failed one", async () => {
  const blocked = deferred();
  const changed = vi.fn(() =>
    changed.mock.calls.length === 1 ? blocked.promise : Promise.resolve(),
  );
  const refresh = createJobRefresh(changed);
  const local = refresh.request("local", () => true);
  const refused = expect(local).rejects.toThrow("Local unavailable");
  const server = refresh.request("server", () => true);
  blocked.reject(new Error("Local unavailable"));
  await Promise.all([refused, server]);
  expect(changed.mock.calls).toEqual([["local"], ["server"]]);
  refresh.dispose();
});
