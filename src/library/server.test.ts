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

it("retains optional catalog addition dates without guessing legacy dates", () => {
  const data = {
    artists: [artist],
    albums: [album],
    server: "http://localhost",
    accountId: "test",
    scannedAt: 1,
  };
  expect(parseSnapshot(data).albums[0]?.addedAt).toBeNull();
  expect(parseSnapshot({ ...data, albums: [{ ...album, added_at: 123 }] }).albums[0]?.addedAt).toBe(
    123,
  );
  expect(() => parseSnapshot({ ...data, albums: [{ ...album, added_at: -1 }] })).toThrow();
});

const publicSnapshot = () => ({
  artists: [],
  albums: [],
  server: "https://catalog.example",
  accountId: "fictional",
  scannedAt: 42,
});
const cachedTrack = {
  reference: "track:@phemios/server/first",
  title: "First track",
  release: null,
  album_title: null,
  disc_no: null,
  track_no: null,
  album_position: null,
  duration_ms: 1000,
  analysis_available: false,
  lyrics_available: true,
  spectrum_available: false,
};
const cachedLabel = {
  reference: "label:@phemios/server/imprint",
  name: "Fictional imprint",
  release_count: 1,
  releases: ["release:@phemios/server/first"],
  biography: {
    text: "Attributed label prose",
    url: "https://source.example/profile",
    lang: "en",
    licence: "CC BY-SA",
    source: "discogs",
  },
};
it("retains exact cached track and label facts without personal fields, while legacy arrays stay unknown", () => {
  const legacy = parseSnapshot(publicSnapshot());
  expect(legacy.tracks).toBeUndefined();
  expect(legacy.labels).toBeUndefined();
  const complete = parseSnapshot({
    ...publicSnapshot(),
    tracks: [{ ...cachedTrack, personal_note: "must not survive" }],
    labels: [cachedLabel],
  });
  expect(complete.tracks).toEqual([{ ...cachedTrack, analyses: [] }]);
  expect(complete.labels).toEqual([
    {
      reference: cachedLabel.reference,
      name: cachedLabel.name,
      releaseCount: 1,
      releases: cachedLabel.releases,
      biography: cachedLabel.biography,
    },
  ]);
});
it("refuses malformed optional projections and duplicate or cross-source identities", () => {
  for (const tracks of [
    null,
    {},
    [cachedTrack, cachedTrack],
    [{ ...cachedTrack, release: "release:@phemios/local/foreign" }],
  ])
    expect(() => parseSnapshot({ ...publicSnapshot(), tracks })).toThrow();
  for (const labels of [
    null,
    {},
    [cachedLabel, cachedLabel],
    [{ ...cachedLabel, releases: ["release:@phemios/local/foreign"] }],
  ])
    expect(() => parseSnapshot({ ...publicSnapshot(), labels })).toThrow();
});
