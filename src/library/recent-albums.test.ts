import { it, expect } from "vitest";
import { recentAlbums } from "./recent-albums";
import type { Album } from "./types";
it("uses catalog entry dates and excludes unknown, future and out-of-window dates", () => {
  const now = 3000000,
    album = (reference: string, addedAt: number | null): Album => ({
      reference,
      artist: null,
      title: reference,
      year: 2026,
      compilation: false,
      tags: [],
      addedAt,
    });
  const rows = [
    album("unknown", null),
    album("future", now + 1),
    album("old", now - 30 * 86400 - 1),
    album("bound", now - 30 * 86400),
    album("new", now),
  ];
  expect(recentAlbums(rows, now).map((a) => a.reference)).toEqual(["new", "bound"]);
});
it("combines the recent toggle with the existing album filters without changing catalog order", async () => {
  const { filterAlbums } = await import("./filtering");
  const now = 4000000;
  const base = { artist: null, year: 2000, compilation: false, tags: [] };
  const albums: Album[] = [
    { ...base, reference: "old", title: "A title", addedAt: now - 31 * 86400 },
    { ...base, reference: "fresh", title: "A title", addedAt: now - 2 },
    { ...base, reference: "other", title: "B title", addedAt: now - 1 },
  ];
  const filters = {
    mode: "both" as const,
    years: [1990, 2010] as const,
    alphabet: [1, 1] as const,
    includeUnknownYear: true,
    query: "title",
    recentOnly: true,
  };
  expect(filterAlbums(albums, [], filters, now).map((a) => a.reference)).toEqual(["fresh"]);
  expect(
    filterAlbums(albums, [], { ...filters, recentOnly: false }, now).map((a) => a.reference),
  ).toEqual(["old", "fresh"]);
});
