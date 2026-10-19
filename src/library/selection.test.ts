import { expect, it } from "vitest";
import {
  selectCountries,
  additiveCountrySelection,
  browseArtists,
  selectAlbumYear,
} from "./selection";
import type { Artist, Album } from "./types";
it("normal clicks replace countries; modifier clicks toggle a deduplicated union", () => {
  expect(selectCountries(["France"], "Suède", false)).toEqual(["Suède"]);
  expect(selectCountries(["France"], "Suède", true)).toEqual(["France", "Suède"]);
  expect(selectCountries(["France", "Suède"], "France", true)).toEqual(["Suède"]);
  expect(selectCountries([null], "France", true)).toEqual([null, "France"]);
  expect(selectCountries(["France"], undefined, false)).toEqual([]);
});
it("uses Command on Mac and Control on Windows/Linux, including keyboard activation", () => {
  expect(additiveCountrySelection({ metaKey: true, ctrlKey: false }, true)).toBe(true);
  expect(additiveCountrySelection({ metaKey: false, ctrlKey: true }, true)).toBe(false);
  expect(additiveCountrySelection({ metaKey: false, ctrlKey: true }, false)).toBe(true);
});
it("browses canonical album artists without discarding contributors from the catalog", () => {
  const artists = ["Band", "Singer", "Guest", "Various"].map(
    (name) =>
      ({
        reference: name,
        name,
        genre: "",
        country: null,
        biography: "",
        artwork: false,
      }) satisfies Artist,
  );
  const albums: Album[] = [
    {
      reference: "x",
      artist: "Band",
      title: "Album",
      year: 2000,
      compilation: false,
      tags: [],
      contributors: ["Singer", "Guest"],
    },
    {
      reference: "y",
      artist: "Various",
      title: "Compilation",
      year: 2000,
      compilation: true,
      tags: [],
      contributors: ["Band"],
    },
  ];
  expect(browseArtists(artists, albums).map((a) => a.name)).toEqual(["Band", "Various"]);
  expect(
    browseArtists(artists, [...albums, { ...albums[0]!, reference: "z", artist: "Singer" }]).map(
      (a) => a.name,
    ),
  ).toEqual(["Band", "Singer", "Various"]);
  expect(artists).toHaveLength(4);
});

it("opening a release year clears the unrelated artist alphabet interval", () => {
  expect(
    selectAlbumYear(
      {
        mode: "both",
        years: [1990, 2020],
        alphabet: [5, 5],
        query: "artist",
        includeUnknownYear: true,
      },
      2016,
    ).alphabet,
  ).toEqual([0, 26]);
});

it("opening an album year also clears recent-only and composer restrictions", () => {
  const next = selectAlbumYear(
    {
      mode: "none",
      years: [0, 9999],
      alphabet: [0, 26],
      query: "",
      includeUnknownYear: true,
      recentOnly: true,
      composers: ["artist:one"],
    },
    2000,
  );
  expect(next.recentOnly).toBe(false);
  expect(next.composers).toEqual([]);
});
