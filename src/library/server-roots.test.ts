import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createDiagnosticRead } from "./diagnostic-read";
import { readServerRoots } from "./server-roots";
it("reads all watched roots without confusing exclusions or orphan rows", async () => {
  const roots = await readServerRoots(async (offset) => ({
    items: offset
      ? [{ path: "/second", status: "watched" }]
      : [
          { path: "/first", status: "watched" },
          { path: "/excluded", status: "excluded" },
          { path: null, status: "unwatched" },
        ],
    total: 4,
    offset,
    scanned_at: 1,
  }));
  expect(roots).toEqual(["/first", "/second"]);
});
it("refuses malformed or mixed-epoch roots", async () => {
  await expect(
    readServerRoots(async (offset) => ({
      items: [{ path: "/one", status: "watched" }],
      total: 2,
      offset,
      scanned_at: offset ? 2 : 1,
    })),
  ).rejects.toThrow();
});

const rootsPage = (offset: number) => ({
  items: Array.from({ length: offset ? 1 : 200 }, (_, index) => ({
    path: `/library/${offset + index}`,
    status: "watched",
  })),
  total: 201,
  offset,
  scanned_at: 1,
});
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
it.each(["cancel", "logout", "disposal"] as const)(
  "does not request another folder page after %s",
  async (retirement) => {
    let finish!: (page: ReturnType<typeof rootsPage>) => void, dispose!: () => void;
    const [scope, setScope] = createSignal<object | false>({});
    const request = vi
      .fn<(offset: number) => Promise<unknown>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementation(async (offset) => rootsPage(offset));
    const read = createRoot((end) => {
      dispose = end;
      return createDiagnosticRead(scope, (_key, admission) =>
        readServerRoots(request, admission.current),
      );
    });
    try {
      await settle();
      expect(request).toHaveBeenCalledExactlyOnceWith(0);
      if (retirement === "cancel") read.cancel();
      else if (retirement === "logout") setScope(false);
      else dispose();
      finish(rootsPage(0));
      await settle();
      expect(request).toHaveBeenCalledTimes(1);
      expect(read.current()).toBeUndefined();
      expect(read.error()).toBe("");
      if (retirement === "cancel") {
        await read.refetch();
        expect(request.mock.calls.map(([offset]) => offset)).toEqual([0, 0, 200]);
        expect(read.current()).toHaveLength(201);
      }
    } finally {
      dispose();
    }
  },
);
it("does not dispatch a folder read whose admission has already expired", async () => {
  const request = vi.fn(async (offset: number) => rootsPage(offset));
  expect(await readServerRoots(request, () => false)).toEqual([]);
  expect(request).not.toHaveBeenCalled();
});
