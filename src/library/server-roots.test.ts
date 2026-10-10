import { expect, it } from "vitest";
import { readServerRoots, scanRootSelection } from "./server-roots";
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
it("refuses malformed or mixed-epoch roots and incomplete replacement", async () => {
  await expect(
    readServerRoots(async (offset) => ({
      items: [{ path: "/one", status: "watched" }],
      total: 2,
      offset,
      scanned_at: offset ? 2 : 1,
    })),
  ).rejects.toThrow();
  expect(() => scanRootSelection([])).toThrow();
  expect(scanRootSelection([" /one ", "/one", "C:\\Music"])).toEqual({
    folders: ["/one", "C:\\Music"],
    replace: true,
  });
  expect(() => scanRootSelection(["relative"])).toThrow();
});
