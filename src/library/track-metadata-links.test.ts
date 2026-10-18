import { expect, it } from "vitest";
import { trackMetadataTarget } from "./track-metadata-links";
import type { Artist, Album } from "./types";
const person: Artist = {
  reference: "artist:guest",
  name: "Guest",
  genre: "",
  country: null,
  biography: "",
  artwork: false,
};
const album: Album = {
  reference: "release:edition",
  artist: null,
  title: "Fixture album",
  year: 2001,
  compilation: false,
  tags: [],
};
const detail = {
  reference: "track:one",
  release: album.reference,
  credits: [{ reference: person.reference, name: person.name, role: "composer", source: "file" }],
};
it("links every named credit and album-artist alias to an existing identity", () => {
  for (const key of [
    "PERFORMERS",
    "LYRICIST",
    "COMPOSER",
    "ALBUM_ARTIST",
    "CONDUCTOR",
    "PRODUCER",
    "performer:guitar",
  ])
    expect(trackMetadataTarget(key, "Guest", detail, [person], [album])).toEqual({
      kind: "route",
      href: "#/artist/artist%3Aguest",
    });
});
it("prefers the current album edition and opens genres, labels and years with their selection", () => {
  expect(
    trackMetadataTarget(
      "album",
      album.title,
      detail,
      [],
      [album, { ...album, reference: "release:other" }],
    ),
  ).toEqual({ kind: "route", href: "#/album/release%3Aedition" });
  expect(trackMetadataTarget("genre", "Metal", detail, [], [])).toEqual({
    kind: "browse",
    section: "genres",
    query: "Metal",
  });
  expect(trackMetadataTarget("label", "Example label", detail, [], [])).toEqual({
    kind: "label",
    source: "server",
    name: "Example label",
  });
  expect(trackMetadataTarget("DATE", "2001-05-12", detail, [], [])?.kind).toBe("browse");
  expect(trackMetadataTarget("DATE", "unknown", detail, [], [])).toBeUndefined();
});
it("never picks another origin or fabricates an identity from raw text", () => {
  const local = { ...person, reference: "artist:@phemios/local/guest" };
  expect(trackMetadataTarget("artist", "Guest", { ...detail, credits: [] }, [local], [])).toEqual({
    kind: "browse",
    section: "artists",
    query: "Guest",
  });
  expect(
    trackMetadataTarget(
      "artist",
      "Guest",
      { ...detail, credits: [] },
      [person, { ...person, reference: "artist:other" }],
      [],
    )?.kind,
  ).toBe("browse");
  expect(trackMetadataTarget("COMMENT", "Guest", detail, [person], [])).toBeUndefined();
});

it("links all canonical person and ensemble credits emitted by Aède", () => {
  for (const key of [
    "choir",
    "mixer",
    "editor",
    "soloist",
    "writer",
    "vocals",
    "background_vocals",
    "executive_producer",
    "co_producer",
    "recording_engineer",
    "assistant_engineer",
    "sound_engineer",
    "albumproducer",
    "albumengineer",
    "albummixer",
    "albumarranger",
    "albummasteringengineer",
    "djmixer",
  ])
    expect(trackMetadataTarget(key, "Guest", detail, [person], [album]), key).toEqual({
      kind: "route",
      href: "#/artist/artist%3Aguest",
    });
});

it("opens sort-name fields through exact source-owned names before reordered aliases", () => {
  const named = { ...person, name: "The Guest" };
  const row = { ...detail, credits: [{ ...detail.credits[0]!, name: "The Guest" }] };
  for (const key of ["artistsort", "albumartistsort", "artist_sort"])
    expect(trackMetadataTarget(key, "Guest, The", row, [named], [])).toEqual({
      kind: "route",
      href: "#/artist/artist%3Aguest",
    });
  expect(
    trackMetadataTarget(
      "artistsort",
      "Guest, The",
      { ...detail, credits: [] },
      [{ ...named, reference: "artist:@phemios/local/guest" }],
      [],
    )?.kind,
  ).toBe("browse");
  expect(
    trackMetadataTarget(
      "artistsort",
      "Guest, The",
      row,
      [{ ...person, name: "Guest, The", reference: "artist:literal" }, named],
      [],
    ),
  ).toEqual({ kind: "route", href: "#/artist/artist%3Aliteral" });
  expect(trackMetadataTarget("COMMENT", "Guest, The", row, [named], [])).toBeUndefined();
});
