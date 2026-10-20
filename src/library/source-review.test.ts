import { afterEach, expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
import { parseSourceReview, parseSourceReviewPage, decideSourceReview } from "./source-review";
import { readSourceReviews } from "./source-review-read";
import { applySourceReview } from "./source-review-actions";
import { changeLanguage } from "../i18n";
const owner = {
  server: "https://catalog.example",
  nativeSession: "1",
  account: { id: "fixture", username: "operator", role: "admin" },
};
const row = {
  id: "1111111111111111",
  revision: "2222222222222222",
  reference: "artist:@phemios/server/example",
  name: "Example",
  kind: "artist" as const,
  source_id: "11111111-1111-4111-8111-111111111111",
  url: "https://musicbrainz.org/artist/11111111-1111-4111-8111-111111111111",
  score: 95,
  decision: null,
  local_mbid: null,
  details: [["type", "Group"]] as [string, string][],
};
const accepted = { ...row, decision: "accepted" as const };
const page = { items: [row], total: 1, offset: 0, limit: 20 };
afterEach(() => {
  vi.resetAllMocks();
  changeLanguage("fr");
});
it("keeps source evidence distinct and rejects unsafe external targets and malformed pages", () => {
  expect(parseSourceReviewPage(page)).toEqual(page);
  for (const url of [
    "javascript:alert(1)",
    "https://musicbrainz.org.evil.example/artist/" + row.source_id,
    row.url + "?next=elsewhere",
    row.url.replace("https:", "http:"),
    "https://musicbrainz.org/release/" + row.source_id,
  ])
    expect(() => parseSourceReview({ ...row, url })).toThrow(/illisibles/);
  for (const value of [
    { ...page, items: [row, row] },
    { ...page, total: 0 },
    { ...page, limit: 0 },
    { ...page, items: [{ ...row, decision: "automatic" }] },
  ])
    expect(() => parseSourceReviewPage(value)).toThrow();
});
it("requires the engine capability before reading stored candidates and never launches enrichment on read", async () => {
  vi.mocked(requestAede).mockResolvedValueOnce({ capabilities: [] });
  await expect(
    readSourceReviews({ source: "server", owner, all: false, query: "", offset: 0 }, () => true),
  ).rejects.toThrow(/Mettez à jour/);
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede)
    .mockClear()
    .mockResolvedValueOnce({ capabilities: ["source_review", "fetch_artist_summary_links"] })
    .mockResolvedValueOnce(page);
  expect(
    await readSourceReviews(
      { source: "server", owner, all: false, query: "Example", offset: 0 },
      () => true,
    ),
  ).toEqual({ ...page, biographies: true });
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/admin/v1/source-review",
    { q: "Example", all: "false", offset: "0", limit: "20" },
    "GET",
    null,
    "server",
    owner,
  );
  expect(vi.mocked(requestAede).mock.calls.every((call) => call[2] === "GET")).toBe(true);
});
it("retires a delayed capability response before dispatching another account-owned read", async () => {
  let current = true;
  vi.mocked(requestAede).mockImplementation(async () => {
    current = false;
    return { capabilities: ["source_review"] };
  });
  expect(
    await readSourceReviews(
      { source: "server", owner, all: false, query: "", offset: 0 },
      () => current,
    ),
  ).toBeUndefined();
  expect(requestAede).toHaveBeenCalledTimes(1);
});
it("sends full immutable selectors and the captured login with each review decision", async () => {
  vi.mocked(requestAede).mockResolvedValueOnce(accepted);
  expect(await decideSourceReview("server", owner, row, "accept")).toEqual(accepted);
  expect(requestAede).toHaveBeenCalledWith(
    "/api/admin/v1/source-review",
    {},
    "PATCH",
    { id: row.id, revision: row.revision, decision: "accept" },
    "server",
    owner,
  );
});
it("starts only the exact accepted artist in the chosen language after preserving the decision", async () => {
  const saved = vi.fn(),
    decide = vi.fn(async () => accepted),
    launch = vi.fn(async () => ({ task: 7 }));
  changeLanguage("en");
  expect(
    await applySourceReview({
      row,
      decision: "accept",
      biography: true,
      current: () => true,
      decide,
      saved,
      launch,
    }),
  ).toContain("#7");
  expect(saved).toHaveBeenCalledWith(accepted);
  expect(launch).toHaveBeenCalledWith({
    summaries: true,
    artist: row.reference,
    full: true,
    yes: true,
    lang: "en",
  });
  expect(saved.mock.invocationCallOrder[0]).toBeLessThan(launch.mock.invocationCallOrder[0]!);
});
it("does not queue biography work or publish confirmations after logout or disposal during acceptance", async () => {
  let current = true;
  const saved = vi.fn(),
    launch = vi.fn();
  expect(
    await applySourceReview({
      row,
      decision: "accept",
      biography: true,
      current: () => current,
      decide: async () => {
        current = false;
        return accepted;
      },
      saved,
      launch,
    }),
  ).toBe("");
  expect(saved).not.toHaveBeenCalled();
  expect(launch).not.toHaveBeenCalled();
});
it("does not replay review or discard its success when biography submission fails or is busy", async () => {
  for (const result of [undefined, { error: "service unavailable" }]) {
    const saved = vi.fn(),
      decide = vi.fn(async () => accepted);
    await expect(
      applySourceReview({
        row,
        decision: "accept",
        biography: true,
        current: () => true,
        decide,
        saved,
        launch: async () => result,
      }),
    ).rejects.toThrow(/Correspondance conservée/);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(accepted);
  }
});
it("does not launch a biography after a rejected write or a refused identity", async () => {
  const launch = vi.fn();
  await expect(
    applySourceReview({
      row,
      decision: "accept",
      biography: true,
      current: () => true,
      decide: async () => {
        throw new Error("stale revision");
      },
      saved: vi.fn(),
      launch,
    }),
  ).rejects.toThrow(/stale/);
  await expect(
    applySourceReview({
      row: { ...row, decision: "rejected" },
      biography: true,
      current: () => true,
      decide: vi.fn(),
      saved: vi.fn(),
      launch,
    }),
  ).rejects.toThrow(/Validez/);
  expect(launch).not.toHaveBeenCalled();
});
