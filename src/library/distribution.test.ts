import { describe, expect, it } from "vitest";
import { distributions, toggleRail } from "./distribution";
import type { Artist, Album, Filters } from "./types";

const artists: Artist[] = [
  { reference: "a", name: "Écho", genre: "Jazz", country: "France", biography: "", artwork: false },
];
const albums: Album[] = [
  { reference: "x", artist: "a", title: "Alpha", year: 2000, compilation: false, tags: [] },
  { reference: "y", artist: "a", title: "Beta", year: 2000, compilation: false, tags: [] },
  { reference: "z", artist: "a", title: "Gamma", year: 2010, compilation: false, tags: [] },
];
const filters: Filters = {
  mode: "both",
  years: [2000, 2000],
  alphabet: [0, 26],
  includeUnknownYear: false,
  query: "",
};
describe("rail distributions", () => {
  it("counts one artist per year even when it has several albums", () => {
    expect(distributions(artists, albums, filters, true).years).toEqual([
      { value: 2000, count: 1 },
      { value: 2010, count: 1 },
    ]);
    expect(distributions(artists, albums, filters, false).years).toEqual([
      { value: 2000, count: 2 },
      { value: 2010, count: 1 },
    ]);
  });
  it("shows a rail's whole distribution while applying the other interval and facets", () => {
    expect(distributions(artists, albums, { ...filters, alphabet: [5, 5] }, true).alphabet).toEqual(
      [{ value: 5, count: 1 }],
    );
    expect(distributions(artists, albums, { ...filters, country: null }, true).years).toEqual([]);
    expect(distributions(artists, albums, { ...filters, alphabet: [2, 2] }, false).years).toEqual([
      { value: 2000, count: 1 },
    ]);
    expect(
      distributions(artists, albums, { ...filters, mode: "alphabet", years: [0, 0] }, false)
        .alphabet,
    ).toHaveLength(3);
  });
  it("keeps at least one rail visible while allowing either or both", () => {
    expect(toggleRail("years", "years")).toBe("years");
    expect(toggleRail("years", "alphabet")).toBe("both");
    expect(toggleRail("both", "years")).toBe("alphabet");
    expect(toggleRail("both", "alphabet")).toBe("years");
  });
});
