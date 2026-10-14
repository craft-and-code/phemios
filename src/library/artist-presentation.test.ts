import { expect, it } from "vitest";
import {
  artistDiscography,
  featuredArtistAlbums,
  artistPresentationImage,
} from "./artist-presentation";
import type { Album, Artist } from "./types";
const artist = { reference: "artist:main" } as Artist;
const album = (reference: string, year: number | null, title = reference): Album => ({
  reference,
  year,
  title,
  artist: artist.reference,
  compilation: false,
  tags: [],
});
it("retains the full chronological principal discography and excludes guest-only appearances", () => {
  const rows = [
    album("later", 2020),
    album("undated", null),
    album("first", 1980),
    { ...album("guest", 1970), artist: "artist:other", contributors: [artist.reference] },
  ];
  expect(artistDiscography(artist, rows).map((row) => row.reference)).toEqual([
    "first",
    "later",
    "undated",
  ]);
  expect(rows.map((row) => row.reference)).toEqual(["later", "undated", "first", "guest"]);
});

it("features only the owner's highest ratings with favourites breaking equal notes", () => {
  const rows = [
    album("first", 1980),
    { ...album("favourite", 1990), rating: 4, favourite: true },
    { ...album("best", 2010), rating: 5 },
    { ...album("same", 2000), rating: 4 },
  ];
  expect(featuredArtistAlbums(rows).map((row) => row.reference)).toEqual(["best", "favourite"]);
  expect(
    featuredArtistAlbums(rows.map(({ rating: _rating, favourite: _favourite, ...row }) => row)).map(
      (row) => row.reference,
    ),
  ).toEqual(["first", "favourite"]);
});
it("prefers available cover art when no album is rated and never fabricates a second album", () => {
  const rows = [
    { ...album("bare", 1980), favourite: true },
    { ...album("cover", 1990), cover: true },
    { ...album("cover-favourite", 2000), cover: true, favourite: true },
  ];
  expect(featuredArtistAlbums(rows).map((row) => row.reference)).toEqual([
    "cover-favourite",
    "cover",
  ]);
  expect(featuredArtistAlbums([rows[0]!])).toEqual([rows[0]]);
  expect(featuredArtistAlbums([])).toEqual([]);
});

it("prefers resident panoramic art for rows while retaining portraits for cards and all fallbacks", () => {
  const artwork = {
    background: "cached-panorama",
    portrait: "cached-portrait",
    banner: "cached-banner",
  };
  expect(artistPresentationImage("editorial", (kind) => artwork[kind])).toBe("cached-panorama");
  expect(artistPresentationImage("discography", (kind) => artwork[kind])).toBe("cached-portrait");
  expect(
    artistPresentationImage("editorial", (kind) =>
      kind === "background" ? undefined : artwork[kind],
    ),
  ).toBe("cached-portrait");
  expect(
    artistPresentationImage("discography", (kind) =>
      kind === "portrait" ? undefined : artwork[kind],
    ),
  ).toBe("cached-panorama");
  for (const view of ["editorial", "discography"] as const) {
    expect(
      artistPresentationImage(view, (kind) => (kind === "banner" ? artwork.banner : undefined)),
    ).toBe("cached-banner");
    expect(artistPresentationImage(view, () => undefined)).toBeUndefined();
  }
});
