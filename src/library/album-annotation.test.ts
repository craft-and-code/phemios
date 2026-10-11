import { expect, it } from "vitest";
import { annotateAlbum } from "./album-annotation";
import { filterAlbums, searchAlbum } from "./filtering";
import type { Album, Artist, Filters } from "./types";
import type { Annotation } from "./server";
const album: Album = {
  reference: "release:@phemios/local/fixture",
  artist: "artist:@phemios/local/fixture",
  title: "Fixture",
  year: 2000,
  compilation: false,
  tags: ["Rock"],
  searchFields: ["FLAC"],
};
const artist: Artist = {
  reference: "artist:@phemios/local/fixture",
  name: "Fixture artist",
  genre: "Rock",
  genres: ["Rock"],
  country: null,
  biography: "",
  artwork: false,
};
const personal: Annotation = {
  reference: album.reference,
  loved: true,
  rating: 4,
  note: "Private commentary",
  tags: ["audit-private"],
};
const filters: Filters = {
  mode: "none",
  years: [0, 9999],
  alphabet: [0, 26],
  includeUnknownYear: true,
  query: "",
};
it("keeps album genre metadata factual after owner tags are saved", () => {
  const decorated = annotateAlbum(album, personal);
  expect(decorated.tags).toEqual(["Rock"]);
  expect(decorated.tags).toBe(album.tags);
  expect(decorated.favourite).toBe(true);
  expect(decorated.rating).toBe(4);
  expect(album).not.toHaveProperty("favourite");
});
it("searches personal tags and notes without treating them as genre facets", () => {
  const decorated = annotateAlbum(album, personal);
  expect(searchAlbum(decorated, artist, "audit-private")).toBe(true);
  expect(searchAlbum(decorated, artist, "commentary")).toBe(true);
  expect(searchAlbum(decorated, artist, "FLAC")).toBe(true);
  expect(filterAlbums([decorated], [artist], { ...filters, genres: ["audit-private"] })).toEqual(
    [],
  );
  expect(filterAlbums([decorated], [artist], { ...filters, genres: ["Rock"] })).toEqual([
    decorated,
  ]);
  expect(annotateAlbum(album, undefined)).toBe(album);
  expect(searchAlbum(annotateAlbum(album, undefined), artist, "audit-private")).toBe(false);
});
