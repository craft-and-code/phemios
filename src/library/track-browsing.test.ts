import { expect, it } from "vitest";
import { trackBrowsePage, trackCollectionExpression } from "./track-browsing";
import type { CatalogTrack } from "./track-page";
const filters = {
  mode: "both" as const,
  years: [1990, 2000] as const,
  alphabet: [1, 1] as const,
  includeUnknownYear: false,
  query: "",
};
const row = (reference: string, title: string, release: string | null): CatalogTrack => ({
  reference,
  title,
  release,
  album_title: release ? "Shared" : null,
  disc_no: null,
  track_no: null,
  album_position: null,
  duration_ms: 60000,
  analyses: [],
  analysis_available: false,
  spectrum_available: false,
});
it("filters complete cached track membership before reversing and paging", () => {
  const tracks = [
    row("track:a", "Alpha", "release:one"),
    row("track:b", "Beta", "release:one"),
    row("track:c", "Another", null),
  ];
  const albums = [{ reference: "release:one", year: 1995 }];
  expect(trackBrowsePage(tracks, albums, filters, false, 0).items.map((r) => r.reference)).toEqual([
    "track:a",
  ]);
  expect(
    trackBrowsePage(tracks, albums, { ...filters, includeUnknownYear: true }, true, 0).items.map(
      (r) => r.reference,
    ),
  ).toEqual(["track:c", "track:a"]);
  expect(
    trackBrowsePage(
      tracks,
      albums,
      { ...filters, mode: "none", query: "Beta" },
      false,
      0,
    ).items.map((r) => r.reference),
  ).toEqual(["track:b"]);
  expect(JSON.parse(trackCollectionExpression(filters, true).slice(10))).toMatchObject({
    view: "tracks",
    reverse: true,
    years: [1990, 2000],
  });
});
