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

it("does not attach an accepted job to an account replaced during the POST", async () => {
  let current = true;
  vi.mocked(requestAede).mockImplementation(async () => {
    current = false;
    return { task_id: 9 };
  });
  await expect(startSourceEnrichment("server", { summaries: true }, () => current)).rejects.toThrow(
    /Session/,
  );
});

it("identifies new artists before the selected families within one server-owned task", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["fetch_musicbrainz_first"] })
    .mockResolvedValueOnce({ task_id: 12 });
  expect(
    await startSourceEnrichment(
      "server",
      { musicbrainz: true, covers: true, fanart: true, yes: true },
      () => true,
    ),
  ).toEqual({ task_id: 12 });
  expect(requestAede).toHaveBeenNthCalledWith(1, "/api/v1/status", {}, "GET", undefined, "server");
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/admin/v1/fetch",
    {},
    "POST",
    { musicbrainz: true, covers: true, fanart: true, yes: true },
    "server",
  );
});

it("refuses an old server instead of silently skipping initial identification", async () => {
  vi.mocked(requestAede).mockClear();
  vi.mocked(requestAede).mockResolvedValue({ capabilities: ["fetch_discogs"] });
  await expect(
    startSourceEnrichment("server", { musicbrainz: true, summaries: true }, () => true),
  ).rejects.toThrow(/MusicBrainz/);
  expect(requestAede).toHaveBeenCalledTimes(1);
});
