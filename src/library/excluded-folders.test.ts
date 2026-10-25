import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createExcludedFolders } from "./excluded-folders";
import type { AccountSession } from "./server";
const owner: AccountSession = {
  server: "https://fixture.example",
  nativeSession: "first",
  account: { id: "admin", username: "admin", role: "admin" },
};
let dispose: () => void;
afterEach(() => dispose?.());
const settle = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
function fixture(order?: Parameters<typeof createExcludedFolders>[0]["order"]) {
  const [session, setSession] = createSignal<AccountSession | undefined>(owner);
  const excluded = new Set(["/music/excluded"]);
  const page = vi.fn(async (_offset: number, _owner: AccountSession) => ({
    items: [
      { path: "/music", status: "watched" },
      ...[...excluded].map((path) => ({ path, status: "excluded" })),
    ],
    total: excluded.size + 1,
    offset: 0,
    scanned_at: 1,
  }));
  const change = vi.fn(async (path: string, action: "exclude" | "include") => {
    if (action === "exclude") excluded.add(path);
    else excluded.delete(path);
  });
  const pick = vi.fn(async () => ["/music/new", "/music/new", "/music/excluded"]);
  const folders = createRoot((end) => {
    dispose = end;
    return createExcludedFolders({ session, page, change, pick, ...(order ? { order } : {}) });
  });
  return { folders, pick, change, page, setSession };
}
it("reads only authoritative exclusions and maps plus/minus to exclude/include without changing roots", async () => {
  const { folders, change, page } = fixture();
  await settle();
  expect(folders.read.current()).toEqual(["/music/excluded"]);
  expect(page).toHaveBeenCalledWith(0, owner);
  await folders.add();
  expect(change.mock.calls).toEqual([["/music/new", "exclude"]]);
  folders.select("/music/new");
  await folders.remove();
  expect(change).toHaveBeenLastCalledWith("/music/new", "include");
  expect(folders.read.current()).toEqual(["/music/excluded"]);
  expect(folders.selection()).toBe("/music/excluded");
});
it.each(["cancel", "logout", "dispose"])("does not apply picked paths after %s", async (mode) => {
  const { folders, pick, change, setSession } = fixture();
  await settle();
  let finish!: (paths: string[]) => void;
  pick.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = folders.add();
  if (mode === "logout") setSession(undefined);
  if (mode === "dispose") dispose();
  finish(mode === "cancel" ? [] : ["/music/late"]);
  await pending;
  expect(change).not.toHaveBeenCalled();
});
it("stops a multi-folder edit at account replacement and does not publish its late failure", async () => {
  const { folders, change, pick, setSession } = fixture();
  await settle();
  pick.mockResolvedValueOnce(["/music/first", "/music/second"]);
  let reject!: (error: Error) => void;
  change.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pending = folders.add();
  await settle();
  setSession({ ...owner, nativeSession: "replacement" });
  reject(new Error("Retired refusal"));
  await pending;
  expect(change).toHaveBeenCalledTimes(1);
  expect(folders.error()).toBe("");
});

it("does not restore a retired exclusion read or its selection after reconnecting", async () => {
  const { folders, page, setSession } = fixture();
  await settle();
  folders.select("/music/excluded");
  let finish!: (value: Awaited<ReturnType<typeof page>>) => void;
  page.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = folders.read.refetch();
  await settle();
  page.mockResolvedValueOnce({
    items: [{ path: "/music/new-owner", status: "excluded" }],
    total: 1,
    offset: 0,
    scanned_at: 1,
  });
  setSession(undefined);
  setSession({ ...owner, nativeSession: "reconnected" });
  await settle();
  expect(folders.read.current()).toEqual(["/music/new-owner"]);
  expect(folders.selection()).toBeUndefined();
  finish({
    items: [{ path: "/music/retired", status: "excluded" }],
    total: 1,
    offset: 0,
    scanned_at: 1,
  });
  await pending;
  await settle();
  expect(folders.read.current()).toEqual(["/music/new-owner"]);
});

it("selects the preceding exclusion after removal and supports repeated Delete/minus operations", async () => {
  const { folders, pick } = fixture();
  await settle();
  pick.mockResolvedValueOnce(["/music/a", "/music/b", "/music/c"]);
  await folders.add();
  folders.select("/music/b");
  await folders.remove();
  expect(folders.selection()).toBe("/music/a");
  await folders.remove();
  expect(folders.selection()).toBe("/music/excluded");
  await folders.remove();
  expect(folders.selection()).toBe("/music/c");
  await folders.remove();
  expect(folders.selection()).toBeUndefined();
  expect(folders.read.current()).toEqual([]);
});
it("does not advance selection when removing the selected exclusion is refused", async () => {
  const { folders, change } = fixture();
  await settle();
  folders.select("/music/excluded");
  change.mockRejectedValueOnce(new Error("Refused"));
  await folders.remove();
  expect(folders.selection()).toBe("/music/excluded");
  expect(folders.error()).toContain("Refused");
});

it("reorders the display without mutating exclusion rules and retains the selected path", async () => {
  let order: string[] = [];
  const presentation = {
    read: async (_owner: AccountSession, paths: string[]) => [
      ...order.filter((path) => paths.includes(path)),
      ...paths.filter((path) => !order.includes(path)),
    ],
    save: vi.fn(async (_owner: AccountSession, paths: string[], current: () => boolean) => {
      if (current()) order = paths;
    }),
  };
  const { folders, pick, change } = fixture(presentation);
  await settle();
  pick.mockResolvedValueOnce(["/music/a", "/music/b"]);
  await folders.add();
  change.mockClear();
  folders.select("/music/b");
  await folders.move("/music/b", "/music/excluded");
  expect(folders.read.current()).toEqual(["/music/b", "/music/excluded", "/music/a"]);
  expect(folders.selection()).toBe("/music/b");
  expect(change).not.toHaveBeenCalled();
  await folders.remove();
  expect(change).toHaveBeenCalledExactlyOnceWith("/music/b", "include");
  expect(folders.selection()).toBe("/music/excluded");
});

it("removes all selected admitted exclusions once, without touching watched roots", async () => {
  const { folders, pick, change } = fixture();
  await settle();
  pick.mockResolvedValueOnce(["/music/a", "/music/b"]);
  await folders.add();
  change.mockClear();
  folders.selectMany(["/music/excluded", "/music/a", "/music/b", "/music", "/music/a"]);
  expect(folders.selections()).toEqual(["/music/excluded", "/music/a", "/music/b"]);
  await folders.remove();
  expect(change.mock.calls).toEqual([
    ["/music/excluded", "include"],
    ["/music/a", "include"],
    ["/music/b", "include"],
  ]);
  expect(folders.read.current()).toEqual([]);
  expect(folders.selections()).toEqual([]);
  expect(folders.selection()).toBeUndefined();
});

it("refreshes a partially refused batch and keeps its failed and unprocessed rows selected", async () => {
  const { folders, pick, change } = fixture();
  await settle();
  pick.mockResolvedValueOnce(["/music/a", "/music/b", "/music/c"]);
  await folders.add();
  folders.selectMany(["/music/a", "/music/b", "/music/c"]);
  change.mockClear();
  const apply = change.getMockImplementation()!;
  change.mockImplementation(async (path, action) => {
    if (path === "/music/b") throw new Error("Refused second exclusion");
    await apply(path, action);
  });
  await folders.remove();
  expect(change.mock.calls).toEqual([
    ["/music/a", "include"],
    ["/music/b", "include"],
  ]);
  expect(folders.read.current()).toEqual(["/music/excluded", "/music/b", "/music/c"]);
  expect(folders.selections()).toEqual(["/music/b", "/music/c"]);
  expect(folders.error()).toContain("Refused second exclusion");
});

it.each(["replace", "logout", "dispose"])("retires a pending removal batch on %s", async (mode) => {
  const { folders, pick, change, setSession } = fixture();
  await settle();
  pick.mockResolvedValueOnce(["/music/a", "/music/b"]);
  await folders.add();
  folders.selectMany(["/music/a", "/music/b"]);
  change.mockClear();
  let finish!: () => void;
  change.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = folders.remove();
  expect(change).toHaveBeenCalledExactlyOnceWith("/music/a", "include");
  if (mode === "dispose") dispose();
  else setSession(mode === "logout" ? undefined : { ...owner, nativeSession: "successor" });
  finish();
  await pending;
  await settle();
  expect(change).toHaveBeenCalledTimes(1);
  expect(folders.error()).toBe("");
  if (mode !== "dispose") expect(folders.selections()).toEqual([]);
});

it("collapses a batch selection on navigation and selects a retained neighbor after subset removal", async () => {
  const { folders, pick } = fixture();
  await settle();
  pick.mockResolvedValueOnce(["/music/a", "/music/b", "/music/c"]);
  await folders.add();
  folders.selectMany(folders.read.current()!);
  folders.select("/music/b");
  expect(folders.selections()).toEqual(["/music/b"]);
  folders.selectMany(["/music/b", "/music/c"]);
  await folders.remove();
  expect(folders.read.current()).toEqual(["/music/excluded", "/music/a"]);
  expect(folders.selections()).toEqual(["/music/a"]);
});
