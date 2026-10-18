import { expect, it } from "vitest";
import { composerExpression, composerAlbumOrder, composerAlbumNames } from "./composers";
import { filterAlbums } from "./filtering";
import { distributions } from "./distribution";
import type { Album, Artist, Filters } from "./types";
const filters: Filters = {
  mode: "none",
  years: [1900, 2026],
  alphabet: [0, 26],
  query: "",
  includeUnknownYear: true,
  composers: ["artist:@phemios/local/writer"],
};
const artist: Artist = {
  reference: "artist:band",
  name: "Band",
  genre: "Rock",
  country: null,
  biography: "",
  artwork: false,
};
const album: Album = {
  reference: "release:one",
  title: "First",
  artist: artist.reference,
  year: 2000,
  compilation: false,
  tags: [],
  composers: filters.composers!,
};
it("selects only exact credited composers, keeps full albums and filters histogram counts", () => {
  const rows = [
    album,
    { ...album, reference: "release:two", composers: ["artist:@phemios/server/writer"] },
    { ...album, reference: "release:three", composers: [] },
  ];
  expect(filterAlbums(rows, [artist], filters)).toEqual([album]);
  expect(distributions([artist], rows, filters, false).years).toEqual([{ value: 2000, count: 1 }]);
});
it("saves original identities and rejects cross-source collection filters", () => {
  expect(JSON.parse(composerExpression(filters, "local").slice(10)).composers).toEqual([
    "artist:writer",
  ]);
  expect(() => composerExpression(filters, "server")).toThrow();
  expect(() =>
    composerExpression({ ...filters, composers: ["artist:@phemios/other/writer"] }, "server"),
  ).toThrow();
});

it("orders the albums by credited composer rather than the album title and reverses that order", () => {
  const a = { ...album, title: "Zebra", composers: ["artist:a"] },
    b = { ...album, reference: "release:two", title: "Alpha", composers: ["artist:b"] };
  const writers = [
    { ...artist, reference: "artist:a", name: "Aaron" },
    { ...artist, reference: "artist:b", name: "Zoe" },
  ];
  expect(composerAlbumOrder([b, a], writers)).toEqual([a, b]);
  expect(composerAlbumOrder([b, a], writers, [], true)).toEqual([b, a]);
});

it("uses the identical credited name for ordering, caption and composer alphabet", () => {
  const writers = [
    { ...artist, reference: "artist:b", name: "Björk" },
    { ...artist, reference: "artist:a", name: "Aaron" },
  ];
  const row = { ...album, composers: ["artist:b", "artist:a"] };
  expect(composerAlbumNames([row], writers).get(row.reference)).toBe("Aaron");
  expect(composerAlbumNames([row], writers, ["artist:b"]).get(row.reference)).toBe("Björk");
});
