import { expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
import { startSourceEnrichment, startEnrichment } from "./enrichment";
it("uses the same operation for both sources and retains a partial failure without duplicating accepted work", async () => {
  const start = vi.fn(async (source: string) => {
    if (source === "server") throw new Error("Update required");
    return { task_id: 7 };
  });
  expect(await startEnrichment(["local", "server"], start)).toEqual([
    { source: "local", task: 7 },
    { source: "server", error: "Error: Update required" },
  ]);
  expect(start.mock.calls).toEqual([["local"], ["server"]]);
});

it("refuses legacy Discogs jobs and late source sessions before any mutation", async () => {
  vi.mocked(requestAede).mockResolvedValue({ capabilities: [] });
  await expect(startSourceEnrichment("local", { discogs: true }, () => true)).rejects.toThrow(
    /Discogs/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["fetch_discogs"] });
  await expect(startSourceEnrichment("server", { discogs: true }, () => false)).rejects.toThrow(
    /Session/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  await startSourceEnrichment("local", { discogs: true, labels: true }, () => true);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/admin/v1/fetch",
    {},
    "POST",
    { discogs: true, labels: true },
    "local",
  );
});
