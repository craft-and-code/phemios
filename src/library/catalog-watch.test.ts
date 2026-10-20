import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createCatalogWatch } from "./catalog-watch";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";

const account: AccountSession = {
  server: "https://music.example",
  account: { id: "reader", username: "reader", role: "user" },
};
let dispose: () => void;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  dispose?.();
  vi.clearAllTimers();
  vi.useRealTimers();
});
function setup() {
  const [session, setSession] = createSignal<AccountSession | undefined>(account);
  const [busy, setBusy] = createSignal(false);
  const read = vi.fn(async (_source: SourceId, _owner: AccountSession) => ({
    catalog_revision: "0",
    scanned_at: 1,
    releases: 1,
    tracks: 2,
  }));
  const refresh = vi.fn(async () => true);
  createRoot((end) => {
    dispose = end;
    createCatalogWatch({
      session: (source) => (source === "server" ? session() : undefined),
      busy,
      read,
      refresh,
    });
  });
  return { setSession, setBusy, read, refresh };
}

it("reloads once per confirmed publication, including equal scan dates and track counts", async () => {
  const test = setup();
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledTimes(1);
  test.read.mockResolvedValue({ catalog_revision: "1", scanned_at: 1, releases: 1, tracks: 2 });
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledTimes(2);
});

it("keeps the last catalogue on network failure and retries failed or busy synchronizations", async () => {
  const test = setup();
  test.read.mockRejectedValueOnce(new Error("offline"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).not.toHaveBeenCalled();
  test.refresh.mockResolvedValueOnce(false);
  await vi.advanceTimersByTimeAsync(5000);
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledTimes(2);
  test.setBusy(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.read).toHaveBeenCalledTimes(3);
});

it("never refreshes a replacement account from a late former session probe", async () => {
  const test = setup();
  let finish!: (value: Awaited<ReturnType<typeof test.read>>) => void;
  test.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await vi.advanceTimersByTimeAsync(5000);
  test.setSession(undefined);
  test.setSession({ ...account });
  finish({ catalog_revision: "99", scanned_at: 1, releases: 1, tracks: 2 });
  await vi.advanceTimersByTimeAsync(0);
  expect(test.refresh).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledOnce();
  expect(test.read.mock.calls.at(-1)?.[1]).not.toBe(account);
});

it("does not overlap probes and stops polling after disposal", async () => {
  const test = setup();
  let finish!: (value: Awaited<ReturnType<typeof test.read>>) => void;
  test.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await vi.advanceTimersByTimeAsync(30000);
  expect(test.read).toHaveBeenCalledOnce();
  dispose();
  finish({ catalog_revision: "0", scanned_at: 1, releases: 1, tracks: 2 });
  await vi.advanceTimersByTimeAsync(30000);
  expect(test.refresh).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("tracks older engines by date and counts while rejecting malformed change markers", async () => {
  const test = setup();
  test.read.mockResolvedValueOnce({ scanned_at: 1, releases: 1, tracks: 2 } as never);
  await vi.advanceTimersByTimeAsync(5000);
  test.read.mockResolvedValueOnce({ scanned_at: 2, releases: 1, tracks: 2 } as never);
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledTimes(2);
  test.read.mockResolvedValueOnce({ catalog_revision: {}, scanned_at: 2 } as never);
  await vi.advanceTimersByTimeAsync(5000);
  expect(test.refresh).toHaveBeenCalledTimes(2);
});

it("observes local and remote publications independently and does no work without sessions", async () => {
  const [local, setLocal] = createSignal<AccountSession | undefined>();
  const [remote, setRemote] = createSignal<AccountSession | undefined>();
  const revisions = { local: "1", server: "1" };
  const read = vi.fn(async (source: SourceId) => ({ catalog_revision: revisions[source] }));
  const refresh = vi.fn(async (_source: SourceId) => true);
  createRoot((end) => {
    dispose = end;
    createCatalogWatch({
      session: (source) => (source === "local" ? local() : remote()),
      busy: () => false,
      read,
      refresh,
    });
  });
  await vi.advanceTimersByTimeAsync(10000);
  expect(read).not.toHaveBeenCalled();
  setLocal({ ...account, server: "https://127.0.0.1:43210" });
  setRemote(account);
  await vi.advanceTimersByTimeAsync(5000);
  expect(refresh.mock.calls.map(([source]) => source)).toEqual(["local", "server"]);
  revisions.local = "2";
  await vi.advanceTimersByTimeAsync(5000);
  expect(refresh.mock.calls.map(([source]) => source)).toEqual(["local", "server", "local"]);
  setLocal(undefined);
  setRemote(undefined);
  await vi.advanceTimersByTimeAsync(10000);
  expect(read).toHaveBeenCalledTimes(4);
});
