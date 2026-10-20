import { expect, it } from "vitest";
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
