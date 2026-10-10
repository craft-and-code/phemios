import { expect, it } from "vitest";
import { albumEntries } from "./album-order";
import type { Album } from "./types";
import type { MissingAlbum } from "./missing";
it("interleaves missing and owned discography entries from oldest to newest, retaining unknown years last", () => {
  const album = (title: string, year: number | null): Album => ({
    reference: `release:${title}`,
    artist: "artist:signal",
    title,
    year,
    compilation: false,
    tags: [],
  });
  const owned = [album("Alpha", 2000), album("Zebra", 1990), album("Undated", null)];
  const missing: MissingAlbum = {
    artist: "artist:signal",
    artist_name: "Signal",
    title: "Middle",
    year: 1995,
    release_group: "12345678-1234-1234-1234-123456789abc",
    set_aside: false,
    source: "musicbrainz",
    url: "https://musicbrainz.org/release-group/12345678-1234-1234-1234-123456789abc",
  };
  expect(albumEntries(owned, [missing], true).map((row) => row.album.title)).toEqual([
    "Zebra",
    "Middle",
    "Alpha",
    "Undated",
  ]);
  expect(albumEntries(owned, [], true).map((row) => row.album.title)).toEqual([
    "Zebra",
    "Alpha",
    "Undated",
  ]);
  expect(albumEntries(owned).map((row) => row.album.title)).toEqual(["Alpha", "Zebra", "Undated"]);
  expect(albumEntries(owned, [missing], true)[1]?.missing).toBe(missing);
});
it("reverses dated discographies without promoting unknown years", () => {
  const album = (title: string, year: number | null): Album => ({
    reference: `release:${title}`,
    artist: "artist:signal",
    title,
    year,
    compilation: false,
    tags: [],
  });
  expect(
    albumEntries(
      [album("Older", 1980), album("Newer", 2000), album("Unknown", null)],
      [],
      true,
      true,
    ).map((row) => row.album.title),
  ).toEqual(["Newer", "Older", "Unknown"]);
});
