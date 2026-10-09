import { it, expect } from "vitest";
import { catalogIndex, artistCardSelection } from "./index";
import { filterAlbums, filterArtists } from "./filtering";
import type { Album, Artist, Filters } from "./types";
const guest: Artist = {
  reference: "guest",
  name: "Guest",
  genre: "Jazz",
  country: null,
  biography: "",
  artwork: false,
  releaseRefs: ["release"],
};
const release: Album = {
  reference: "release",
  title: "Compilation",
  artist: null,
  year: 2001,
  compilation: true,
  tags: [],
  contributors: ["guest", "guest"],
  searchFields: ["custom description"],
};
const filters: Filters = {
  mode: "both",
  years: [1900, 2026],
  alphabet: [0, 26],
  includeUnknownYear: true,
  query: "",
};
it("deduplicates contribution paths and preserves compilations with no principal artist", () => {
  const index = catalogIndex([guest], [release]);
  expect(index.albumsByArtist.get("guest")).toEqual([release]);
  expect(index.artistsByAlbum.get("release")).toEqual([guest]);
  expect(filterArtists([guest], [release], filters)).toEqual([guest]);
  expect(filterAlbums([release], [guest], filters)).toEqual([release]);
});
it("reuses immutable indexes and rebuilds when a snapshot is replaced", () => {
  const artists = [guest],
    albums = [release];
  expect(catalogIndex(artists, albums)).toBe(catalogIndex(artists, albums));
  expect(catalogIndex(artists, [...albums])).not.toBe(catalogIndex(artists, albums));
});
it("indexes custom tags and personal notes without stale annotation results", () => {
  expect(
    filterAlbums([release], [guest], { ...filters, query: "custom description" }),
  ).toHaveLength(1);
  expect(
    filterAlbums([{ ...release, note: "A private memory" }], [guest], {
      ...filters,
      query: "private memory",
    }),
  ).toHaveLength(1);
  expect(
    filterAlbums([{ ...release, note: "Revised" }], [guest], {
      ...filters,
      query: "private memory",
    }),
  ).toHaveLength(0);
});
it("keeps albumless artists as unknown-year entries only when permitted", () => {
  expect(filterArtists([guest], [], filters)).toEqual([guest]);
  expect(filterArtists([guest], [], { ...filters, includeUnknownYear: false })).toEqual([]);
});
it("filters a large fictional snapshot through its associations", () => {
  const artists = Array.from({ length: 10000 }, (_, i) => ({
    ...guest,
    reference: `artist:${i}`,
    name: `Artist ${i}`,
    releaseRefs: [],
  }));
  const albums = artists.map((artist, i) => ({
    ...release,
    reference: `album:${i}`,
    artist: artist.reference,
    contributors: [],
    searchFields: [],
  }));
  expect(filterArtists(artists, albums, filters)).toHaveLength(10000);
  expect(catalogIndex(artists, albums).albumsByArtist.get("artist:9999")).toHaveLength(1);
});

it("searches favourite candidates only through their own credited artists", () => {
  const stranger = { ...guest, reference: "stranger", name: "Unrelated", releaseRefs: [] };
  expect(filterAlbums([release], [guest, stranger], { ...filters, query: "Unrelated" })).toEqual(
    [],
  );
  expect(filterAlbums([release], [guest, stranger], { ...filters, query: "Guest" })).toEqual([
    release,
  ]);
});

it("plays the principal artist's chronological discography instead of an earlier guest-credit cover", () => {
  const artist = { ...guest, reference: "artist:signal", name: "Signal" };
  const contribution = {
    ...release,
    reference: "release:guest",
    artist: "artist:another",
    year: 1980,
    cover: true,
    contributors: [artist.reference],
  };
  const newest = {
    ...release,
    reference: "release:newest",
    artist: artist.reference,
    year: 2000,
    cover: true,
  };
  const oldest = { ...newest, reference: "release:oldest", year: 1990 };
  const chosen = artistCardSelection(artist, [contribution, newest, oldest]);
  expect(chosen.reference).toBe(artist.reference);
  expect(chosen.title).toBe(artist.name);
  expect(chosen.cover).toBe(contribution);
  expect(artistCardSelection(artist, [contribution]).reference).toBe(artist.reference);
});
