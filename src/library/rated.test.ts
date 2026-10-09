import { expect, it } from "vitest";
import { albumRating, ratedAlbums } from "./rated";
import type { Album } from "./types";
import type { Annotation } from "./server";
it("combines rated albums and principal artist albums without inheriting personnel ratings", () => {
  const albums: Album[] = [
    {
      reference: "release:a",
      artist: "artist:a",
      title: "A",
      year: 2000,
      compilation: false,
      tags: [],
    },
    {
      reference: "release:b",
      artist: "artist:b",
      title: "B",
      year: 2000,
      compilation: false,
      tags: [],
      contributors: ["artist:a"],
    },
    { reference: "release:c", artist: null, title: "C", year: 2000, compilation: true, tags: [] },
  ];
  const value = (reference: string, rating: number): Annotation => ({
    reference,
    rating,
    loved: false,
    tags: [],
    note: null,
  });
  const annotations = {
    "artist:a": value("artist:a", 4),
    "release:a": value("release:a", 5),
    "release:c": value("release:c", 2),
  };
  expect(ratedAlbums(albums, annotations, 1)).toEqual([albums[0], albums[2]]);
  expect(ratedAlbums(albums, annotations, 3)).toEqual([albums[0]]);
  expect(albumRating(albums[0]!, annotations)).toBe(5);
  expect(ratedAlbums(albums, annotations, 2, 4)).toEqual([albums[2]]);
  expect(ratedAlbums(albums, annotations, 5, 5)).toEqual([albums[0]]);
  expect(ratedAlbums(albums, annotations, 4, 2)).toEqual([]);
});
