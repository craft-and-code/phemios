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
