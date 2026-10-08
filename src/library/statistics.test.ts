import { expect, it, vi } from "vitest";
import { parseDiagnosis, statisticsReader, parseStatistics } from "./statistics";
const page = (items: unknown[] = [], total = items.length, offset = 0) => ({
  items,
  total,
  offset,
  limit: 50,
  scanned_at: 1,
});
const sample = () => ({
  scanned_at: 1,
  files: 10,
  tracks: 12,
  albums: 2,
  compilations: 1,
  artists: 8,
  album_artists: 2,
  labels: 1,
  genres: 3,
  duration_ms: 60000,
  bytes: 1000,
  tracks_without_album: 0,
  completeness: { covers: 0.5, years: 1, genres: 1, mbid: 0 },
  by_codec: page([{ label: "FLAC", count: 10, bytes: 1000 }]),
  by_quality: page(),
  by_sample_rate: page(),
  by_decade: page(),
  by_country: page(),
  roles: page(),
  top: {
    artists: page(
      Array.from({ length: 50 }, (_, i) => ({
        reference: `artist:fictional${i}`,
        name: `Band ${i}`,
        tracks: 12,
      })),
      51,
    ),
    writers: page(),
  },
});
it("preserves whole-library totals and distinct artist/album-artist populations", () => {
  const report = parseStatistics(sample(), 0);
  expect(report.artists).toBe(8);
  expect(report.album_artists).toBe(2);
  expect(report.completeness.covers).toBe(0.5);
  expect(report.top.artists.total).toBe(51);
});
it("rejects invalid ratios, truncated pages and unsafe integer totals", () => {
  expect(() => parseStatistics({ ...sample(), bytes: Number.MAX_SAFE_INTEGER + 1 }, 0)).toThrow();
  expect(() =>
    parseStatistics({ ...sample(), completeness: { ...sample().completeness, covers: 2 } }, 0),
  ).toThrow();
  expect(() => parseStatistics({ ...sample(), by_codec: page([], 1) }, 0)).toThrow();
  expect(() => parseStatistics(sample(), 50)).toThrow();
});
it("shares reads across tables at one offset but refuses mixed scan epochs", async () => {
  const read = vi.fn(async (offset: number) =>
    offset === 0 ? sample() : { ...sample(), scanned_at: 2 },
  );
  const reader = statisticsReader(read);
  await Promise.all([reader(0), reader(0)]);
  expect(read).toHaveBeenCalledOnce();
  await expect(reader(50)).rejects.toThrow();
});

it("validates diagnostic totals instead of treating missing measurements as zero", () => {
  expect(
    parseDiagnosis({
      summary: { error: 0, warning: 2, info: 3 },
      unverified_files: 4,
      pending_analyses: 5,
    }).summary.warning,
  ).toBe(2);
  expect(() =>
    parseDiagnosis({ summary: { warning: 2 }, unverified_files: 4, pending_analyses: 5 }),
  ).toThrow();
});
