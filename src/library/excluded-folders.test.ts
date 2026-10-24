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
function fixture() {
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
    return createExcludedFolders({ session, page, change, pick });
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
  expect(folders.selection()).toBeUndefined();
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
