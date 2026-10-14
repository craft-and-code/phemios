import { expect, it } from "vitest";
import { artistDiscography, createArtistPositions } from "./artist-presentation";
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
it("remembers each carousel independently across layouts and removes retired artist positions", () => {
  const positions = createArtistPositions(),
    rows = [album("first", 1980), album("later", 2020)];
  positions.forArtist("a").restore(rows, false);
  positions.forArtist("a").select("later");
  expect(positions.forArtist("b").restore(rows, false)).toBe("first");
  expect(positions.forArtist("a").restore(rows, false)).toBe("later");
  positions.retain(["b"]);
  expect(positions.forArtist("a").restore(rows, false)).toBe("first");
});
