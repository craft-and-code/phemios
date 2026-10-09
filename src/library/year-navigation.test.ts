import { expect, it } from "vitest";
import { selectAlbumYear } from "./selection";
import { filterAlbums } from "./filtering";
import type { Album, Filters } from "./types";

it("opens the complete release year despite unrelated previous browse criteria", () => {
  const previous: Filters = {
    mode: "both",
    years: [1970, 1980],
    alphabet: [1, 1],
    includeUnknownYear: true,
    query: "unrelated",
    countries: ["France"],
    genre: "Metal",
    genres: ["Rock"],
  };
  const albums: Album[] = [2015, 2016, 2016, 2017, null].map((year, index) => ({
    reference: String(index),
    artist: null,
    title: `Release ${index}`,
    year,
    compilation: false,
    tags: [],
  }));
  const selected = selectAlbumYear(previous, 2016);
  expect(filterAlbums(albums, [], selected).map((album) => album.reference)).toEqual(["1", "2"]);
  expect(selected.mode).toBe("years");
  expect(selected.years).toEqual([2016, 2016]);
  expect(previous.years).toEqual([1970, 1980]);
});
