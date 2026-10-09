import { describe, expect, it } from "vitest";
import { filterAlbums, filterArtists, initialIndex, shiftInterval } from "./filtering";
import type { Album, Artist, Filters } from "./types";

const artists: Artist[] = [
  { reference: "one", name: "Émile", genre: "Jazz", country: null, biography: "", artwork: false },
  {
    reference: "two",
    name: "Orée",
    genre: "Rock",
    country: "France",
    biography: "",
    artwork: true,
  },
];
const albums: Album[] = [
  {
    reference: "a",
    artist: "one",
    title: "Zénith",
    year: 2000,
    compilation: false,
    tags: ["piano"],
  },
  { reference: "b", artist: "two", title: "Aube", year: 2010, compilation: false, tags: [] },
  {
    reference: "c",
    artist: "two",
    title: "1999 sessions",
    year: null,
    compilation: false,
    tags: [],
  },
];
const defaults: Filters = {
  mode: "both",
  years: [2000, 2010],
  alphabet: [0, 26],
  includeUnknownYear: false,
  query: "",
};

describe("sliding intervals", () => {
  it("moves a period without resizing it, including at both domain edges", () => {
    expect(shiftInterval([5, 10], 3, [0, 20])).toEqual([8, 13]);
    expect(shiftInterval([5, 10], -99, [0, 20])).toEqual([0, 5]);
    expect(shiftInterval([5, 10], 99, [0, 20])).toEqual([15, 20]);
  });
  it("moves a single letter and refuses invalid or nonfinite intervals", () => {
    expect(shiftInterval([3, 3], 2, [0, 26])).toEqual([5, 5]);
    expect(() => shiftInterval([10, 5], 1, [0, 20])).toThrow();
    expect(() => shiftInterval([0, 21], 1, [0, 20])).toThrow();
    expect(() => shiftInterval([0, 20], Infinity, [0, 20])).toThrow();
  });
});

describe("library filtering", () => {
  it("includes exact year boundaries and handles missing years only on request", () => {
    expect(filterAlbums(albums, artists, defaults).map((a) => a.reference)).toEqual(["a", "b"]);
    expect(filterAlbums(albums, artists, { ...defaults, includeUnknownYear: true })).toHaveLength(
      3,
    );
  });
  it("folds accents and ligatures and keeps nonletters in their own bucket", () => {
    expect(initialIndex(" Émile")).toBe(5);
    expect(initialIndex("Œuvre")).toBe(15);
    expect(initialIndex("æther")).toBe(1);
    expect(initialIndex("1999 sessions")).toBe(0);
    expect(initialIndex("")).toBe(0);
  });
  it("intersects rails and uses artist names rather than album names for the artist list", () => {
    expect(
      filterArtists(artists, albums, { ...defaults, alphabet: [5, 5] }).map((a) => a.name),
    ).toEqual(["Émile"]);
    expect(filterAlbums(albums, artists, { ...defaults, alphabet: [5, 5] })).toHaveLength(0);
  });
  it("a hidden rail does not silently retain a filter", () => {
    expect(
      filterAlbums(albums, artists, { ...defaults, mode: "years", alphabet: [5, 5] }),
    ).toHaveLength(2);
    expect(
      filterAlbums(albums, artists, { ...defaults, mode: "alphabet", years: [0, 1] }),
    ).toHaveLength(3);
  });
  it("searches provided tags and origin while preserving unknown origin", () => {
    expect(
      filterAlbums(albums, artists, { ...defaults, query: "PIANO" }).map((a) => a.reference),
    ).toEqual(["a"]);
    expect(
      filterArtists(artists, albums, { ...defaults, query: "France" }).map((a) => a.reference),
    ).toEqual(["two"]);
  });
});

it("disabling both rails releases narrowed bounds and unknown-year exclusion", () => {
  const hidden = {
    ...defaults,
    mode: "none" as const,
    years: [0, 0] as const,
    alphabet: [0, 0] as const,
  };
  expect(filterAlbums(albums, artists, hidden)).toHaveLength(3);
  expect(filterArtists(artists, albums, hidden)).toHaveLength(2);
});

it("selected countries are a union intersected with genre and query", () => {
  expect(filterArtists(artists, albums, { ...defaults, countries: [null, "France"] })).toHaveLength(
    2,
  );
  expect(
    filterArtists(artists, albums, { ...defaults, countries: [null, "France"], genre: "Rock" }),
  ).toHaveLength(1);
  expect(
    filterArtists(artists, albums, { ...defaults, countries: ["France"], query: "PIANO" }),
  ).toHaveLength(0);
  expect(filterArtists(artists, albums, { ...defaults, countries: [] })).toHaveLength(2);
});

it("unions multiple selected genres while retaining country intersection", () => {
  expect(filterArtists(artists, albums, { ...defaults, genres: ["Jazz", "Rock"] })).toHaveLength(2);
  expect(
    filterArtists(artists, albums, {
      ...defaults,
      genres: ["Jazz", "Rock"],
      countries: ["France"],
    }),
  ).toHaveLength(1);
  expect(filterAlbums(albums, artists, { ...defaults, genres: ["Absent"] })).toHaveLength(0);
});
