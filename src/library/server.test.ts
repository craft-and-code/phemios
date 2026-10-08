import { expect, it } from "vitest";
import { parseSnapshot, sourceLink } from "./server";
const artist = {
  reference: "artist:1",
  name: "Écho",
  genre: "Rock",
  genres: ["Rock"],
  country: "GB",
  country_code: "GB",
  biography: "",
  release_refs: ["album:1"],
  search_fields: [],
  media: {},
  biography_credit: null,
};
const album = {
  reference: "album:1",
  artist: null,
  title: "Guests",
  year: 2002,
  compilation: true,
  tags: [],
  contributors: ["artist:1"],
  search_fields: [],
  track_count: 1,
};
it("preserves compilations, contributors and unknown origins without guessing", () => {
  const result = parseSnapshot({
    artists: [artist, { ...artist, reference: "artist:2", country: null, country_code: null }],
    albums: [album],
    server: "https://fictional.example",
    accountId: "test",
    scannedAt: 1,
  });
  expect(result.albums[0]?.artist).toBeNull();
  expect(result.artists[0]?.country).toBe("Royaume-Uni");
  expect(result.artists[1]?.country).toBeNull();
});
it("refuses duplicate identities and malformed years", () => {
  expect(() =>
    parseSnapshot({
      artists: [artist, artist],
      albums: [],
      server: "http://localhost",
      accountId: "test",
    }),
  ).toThrow();
  expect(() =>
    parseSnapshot({
      artists: [artist],
      albums: [{ ...album, year: 10000 }],
      server: "http://localhost",
      accountId: "test",
    }),
  ).toThrow();
});
it("attributed links cannot execute code", () => {
  expect(sourceLink("javascript:alert(1)")).toBeUndefined();
  expect(sourceLink("https://example.org/bio")).toBe("https://example.org/bio");
});

it("rejects malformed relationship provenance instead of drawing invented edges", () => {
  expect(() =>
    parseSnapshot({
      artists: [
        {
          ...artist,
          relations: [
            { reference: null, name: "Unknown", weight: -1, kind: "collaborated", source: "tags" },
          ],
        },
      ],
      albums: [],
      server: "http://localhost",
      accountId: "test",
      scannedAt: 1,
    }),
  ).toThrow();
});
