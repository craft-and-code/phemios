import { afterEach, expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
import { startSourceEnrichment } from "./enrichment";
afterEach(() => vi.resetAllMocks());
it("does not send exact artist jobs to older engines or after login replacement during admission", async () => {
  const input = { artist: "artist:example", summaries: true };
  vi.mocked(requestAede).mockResolvedValueOnce({ capabilities: [] });
  await expect(startSourceEnrichment("server", input, () => true)).rejects.toThrow(
    /biographie de cet artiste/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede)
    .mockClear()
    .mockResolvedValueOnce({ capabilities: ["fetch_artist_summary_links"] });
  await expect(startSourceEnrichment("server", input, () => false)).rejects.toThrow(/Session/);
  expect(requestAede).toHaveBeenCalledTimes(1);
});
it("forwards a validated exact artist selector without changing sources or adding broad identification", async () => {
  const input = {
    artist: "artist:@phemios/local/example",
    summaries: true,
    full: true,
    yes: true,
    lang: "fr",
  };
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["fetch_artist_summary_links"] })
    .mockResolvedValueOnce({ task_id: 4 });
  expect(await startSourceEnrichment("local", input, () => true)).toEqual({ task_id: 4 });
  expect(requestAede).toHaveBeenLastCalledWith("/api/admin/v1/fetch", {}, "POST", input, "local");
});
