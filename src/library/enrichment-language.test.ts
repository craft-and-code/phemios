import { afterEach, expect, it, vi } from "vitest";
import { changeLanguage } from "../i18n";
import { requestAede } from "../platform/desktop";
import { enrichmentOptions, startSourceEnrichment } from "./enrichment";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => {
  changeLanguage("fr");
  vi.resetAllMocks();
});
const preferences = {
  summaries: true,
  covers: false,
  fanart: false,
  lyrics: false,
  discogs: false,
};
it.each(["fr", "en"] as const)(
  "sends the App's %s language to both enrichment sources",
  async (language) => {
    changeLanguage(language);
    const input = enrichmentOptions(preferences);
    for (const source of ["local", "server"] as const) {
      vi.mocked(requestAede)
        .mockResolvedValueOnce({ capabilities: ["fetch_musicbrainz_first"] })
        .mockResolvedValueOnce({ task_id: 7 });
      await startSourceEnrichment(source, input, () => true);
      expect(requestAede).toHaveBeenLastCalledWith(
        "/api/admin/v1/fetch",
        {},
        "POST",
        expect.objectContaining({ summaries: true, lang: language }),
        source,
      );
    }
  },
);
it("captures the submitting language even when the App changes language during admission", async () => {
  changeLanguage("fr");
  const input = enrichmentOptions(preferences);
  vi.mocked(requestAede)
    .mockImplementationOnce(async () => {
      changeLanguage("en");
      return { capabilities: ["fetch_musicbrainz_first"] };
    })
    .mockResolvedValueOnce({ task_id: 8 });
  await startSourceEnrichment("local", input, () => true);
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/admin/v1/fetch",
    {},
    "POST",
    expect.objectContaining({ lang: "fr" }),
    "local",
  );
});
