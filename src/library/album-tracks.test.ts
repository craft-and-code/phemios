import { expect, it, vi } from "vitest";
import { albumTracks, discGroups, hasMultipleDiscs } from "./album-tracks";
import { requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const rows = Array.from({ length: 85 }, (_, i) => ({
  reference: `track:fictional-${i}`,
  title: `Theme ${(i % 22) + 1}`,
  disc_no: Math.floor(i / 22) + 1,
  track_no: (i % 22) + 1,
  album_position: i + 1,
  duration_ms: 123000,
  analysis_available: i === 0,
  spectrum_available: false,
  ...(i === 0 ? { lyrics_available: true } : {}),
}));
it("shows a disc label only when the album has distinct known CDs", () => {
  expect(hasMultipleDiscs([{ disc_no: 1 }, { disc_no: 1 }])).toBe(false);
  expect(hasMultipleDiscs([{ disc_no: null }, { disc_no: 1 }])).toBe(false);
  expect(hasMultipleDiscs([{ disc_no: 1 }, { disc_no: 2 }])).toBe(true);
  expect(hasMultipleDiscs([])).toBe(false);
});
it("loads a four-disc album from bounded pages, retaining duplicate titles and play indices", async () => {
  vi.mocked(requestAede).mockImplementation(async (_path, query) => {
    const offset = Number(query?.offset);
    return { items: rows.slice(offset, offset + 50), total: 85, offset, scanned_at: 123 };
  });
  const tracks = await albumTracks("release:fictional");
  expect(requestAede).toHaveBeenCalledTimes(2);
  expect(tracks).toHaveLength(85);
  expect(tracks[0]?.lyrics_available).toBe(true);
  expect(tracks[1]?.lyrics_available).toBeUndefined();
  const groups = discGroups(tracks);
  expect(groups.map((g) => g.disc)).toEqual([1, 2, 3, 4]);
  expect(groups[1]?.tracks[0]?.index).toBe(22);
  expect(groups[1]?.tracks[0]?.track.track_no).toBe(1);
  expect(groups.flatMap((g) => g.tracks).map((r) => r.track.reference)).toEqual(
    rows.map((r) => r.reference),
  );
});
it("refuses incomplete or changed pages and explains an outdated disc contract", async () => {
  vi.mocked(requestAede).mockResolvedValue({
    items: [{ reference: "track:old", title: "Old" }],
    total: 1,
    offset: 0,
    scanned_at: 123,
  });
  await expect(albumTracks("release:fictional")).rejects.toThrow(/redémarr/i);
  vi.mocked(requestAede).mockResolvedValue({ items: [], total: 85, offset: 0, scanned_at: 123 });
  await expect(albumTracks("release:fictional")).rejects.toThrow(/page/i);
  vi.mocked(requestAede).mockImplementation(async (_path, query) => {
    const offset = Number(query?.offset);
    return {
      items: rows.slice(offset, offset + 50),
      total: 85,
      offset,
      scanned_at: offset ? 124 : 123,
    };
  });
  await expect(albumTracks("release:fictional")).rejects.toThrow(/changé/i);
});
