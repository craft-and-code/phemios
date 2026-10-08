import { expect, it } from "vitest";
import { favouriteAlbums } from "./favourites";
import type { Album } from "./types";
import type { Annotation } from "./server";
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
    year: 2001,
    compilation: false,
    tags: [],
    contributors: ["artist:a"],
  },
  { reference: "release:c", artist: null, title: "C", year: 2002, compilation: true, tags: [] },
];
const loved = (reference: string): Annotation => ({
  reference,
  loved: true,
  rating: null,
  note: null,
  tags: [],
});
it("combines favourite albums and the discography of favourite principal artists once", () => {
  expect(
    favouriteAlbums(albums, {
      "artist:a": loved("artist:a"),
      "release:a": loved("release:a"),
      "release:c": loved("release:c"),
    }),
  ).toEqual([albums[0], albums[2]]);
});
it("keeps supporting credits and ratings separate from favourites", () => {
  expect(
    favouriteAlbums(albums, { "artist:a": { ...loved("artist:a"), loved: false, rating: 5 } }),
  ).toEqual([]);
});
