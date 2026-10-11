import { expect, it } from "vitest";
import { artistCatalogue } from "./artist-catalogue";
import type { Artist, Album } from "./types";
const artist: Artist = {
  reference: "artist:guest",
  name: "Guest",
  genre: "",
  country: null,
  biography: "",
  artwork: false,
};
const album: Album = {
  reference: "release:one",
  artist: "artist:band",
  title: "First",
  year: 2000,
  compilation: false,
  tags: [],
  contributors: [artist.reference],
};
it("features credited albums for a musician who has no principal discography", () => {
  const selection = artistCatalogue(artist, [album]);
  expect(selection.featured).toEqual([album]);
  expect(selection.credited).toBe(true);
});
it("keeps principal albums separate from appearances and respects edition references", () => {
  const own = { ...album, reference: "release:own", artist: artist.reference };
  const selection = artistCatalogue(artist, [album, own]);
  expect(selection.featured).toEqual([own]);
  expect(selection.appearances).toEqual([album]);
  expect(
    artistCatalogue({ ...artist, releaseRefs: [album.reference] }, [{ ...album, contributors: [] }])
      .featured,
  ).toHaveLength(1);
  expect(artistCatalogue(artist, [{ ...album, contributors: [] }]).featured).toHaveLength(0);
});
