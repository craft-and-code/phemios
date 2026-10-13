import { afterEach, expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { readCollectionPlayback } from "./collection-playback";
import type { AccountSession } from "./server";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const session: AccountSession = {
  server: "https://fixture.example",
  account: { id: "one", username: "one", role: "user" },
  nativeSession: "fixture-ticket",
};
const album = {
  reference: "release:one",
  title: "Album",
  artist: null,
  year: 2000,
  compilation: false,
  tags: [],
  trackCount: 8,
};
const row = (i: number) => ({
  reference: `track:${i}`,
  title: `Track ${i}`,
  release: album.reference,
  album_title: album.title,
  disc_no: 1,
  track_no: i,
  album_position: i,
  duration_ms: 5000,
  analysis_available: false,
  spectrum_available: false,
});
const page = (items: unknown[], total = items.length, offset = 0, scanned_at = 12) => ({
  items,
  total,
  offset,
  limit: 50,
  scanned_at,
});
const read = (current = () => true) =>
  readCollectionPlayback("Chosen", "server", session, [album], 12, current);
it("reads the latest private rule and plays only matching tracks in server order", async () => {
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ name: "Chosen", expression: "album.rating:4..5" })
    .mockResolvedValueOnce(page([row(8), row(2)]));
  expect(await read()).toEqual({
    items: [
      {
        reference: "track:8",
        title: "Track 8",
        release: album.reference,
        number: 8,
        album_total: 8,
      },
      {
        reference: "track:2",
        title: "Track 2",
        release: album.reference,
        number: 2,
        album_total: 8,
      },
    ],
  });
  expect(requestAede).toHaveBeenNthCalledWith(
    1,
    "/api/me/v1/collection",
    { name: "Chosen" },
    "GET",
    null,
    "server",
    session,
  );
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/search",
    { expression: "album.rating:4..5", offset: "0", limit: "50" },
    "GET",
    null,
    "server",
    session,
  );
});
it("admits complete bounded pages and rejects changed catalog epochs", async () => {
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ name: "Chosen", expression: "played:>=0" })
    .mockResolvedValueOnce(
      page(
        Array.from({ length: 50 }, (_, i) => ({ ...row(1), reference: `track:${i}` })),
        51,
      ),
    )
    .mockResolvedValueOnce(page([row(2)], 51, 50, 13));
  await expect(read()).rejects.toThrow(/resynchronisez/);
  expect(requestAede).toHaveBeenCalledTimes(3);
});
it.each([0, 4097])(
  "refuses empty or oversized selection before collecting more rows: %s",
  async (total) => {
    vi.mocked(requestAede)
      .mockResolvedValueOnce({ name: "Chosen", expression: "played:>=0" })
      .mockResolvedValueOnce(
        page(
          total
            ? Array.from({ length: 50 }, (_, i) => ({ ...row(1), reference: `track:${i}` }))
            : [],
          total,
        ),
      );
    await expect(read()).rejects.toThrow();
    expect(requestAede).toHaveBeenCalledTimes(2);
  },
);
it("does not query after cancellation or owner replacement", async () => {
  let current = true;
  vi.mocked(requestAede).mockImplementationOnce(async () => {
    current = false;
    return { name: "Chosen", expression: "played:>=0" };
  });
  expect(await read(() => current)).toBeUndefined();
  expect(requestAede).toHaveBeenCalledOnce();
});
it("refuses missing release metadata and duplicate identities rather than widening membership", async () => {
  for (const items of [[{ ...row(1), release: "release:missing" }], [row(1), row(1)]]) {
    vi.mocked(requestAede)
      .mockResolvedValueOnce({ name: "Chosen", expression: "played:>=0" })
      .mockResolvedValueOnce(page(items));
    await expect(read()).rejects.toThrow();
  }
});
