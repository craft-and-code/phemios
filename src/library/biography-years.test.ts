import { expect, it } from "vitest";
import { biographyLinker } from "./biography-links";

const album = {
  reference: "release:first",
  title: "Fictional Record",
  artist: null,
  year: 1970,
  tags: [],
};
const link = (years: (number | null)[]) =>
  biographyLinker([], "artist:solo", {
    albums: years.map((year, index) => ({ ...album, reference: `release:${index}`, year })),
    tracks: [],
  });
it("links a biography year only when the retained catalogue contains albums from that year", () => {
  const text = "Aster Vale, né le 3 décembre 1948, évoque un titre de 1970.";
  const parts = link([1970, 1970, null])(text);
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(parts.filter((part) => part.target)).toEqual([
    { text: "1970", target: { kind: "year", year: 1970 } },
  ]);
  expect(link([])(text)).toEqual([{ text }]);
});
it("links the year inside complete dates and intervals while preserving their literal spelling", () => {
  const text = "3 décembre 1948 · 1970–1971 · (1970).";
  const parts = link([1948, 1970, 1971])(text);
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(parts.filter((part) => part.target).map((part) => part.text)).toEqual([
    "1948",
    "1970",
    "1971",
    "1970",
  ]);
});
it("does not extract a year from a longer number or an alphanumeric identifier", () => {
  const text = "19700 · 11970 · x1970 · 1970x";
  expect(link([1970])(text)).toEqual([{ text }]);
});
it("uses owned albums from the combined admitted catalogue, independently of the biography artist", () => {
  const parts = biographyLinker([], "artist:solo", {
    albums: [{ ...album, reference: "release:@phemios/local/other-library" }],
    tracks: [],
  })("En 1970.");
  expect(parts.find((part) => part.target)?.target).toEqual({ kind: "year", year: 1970 });
});
it("does not split an already linked full title into a nested year link", () => {
  const parts = biographyLinker([], "artist:solo", {
    albums: [album],
    tracks: [
      {
        reference: "track:one",
        title: "Fictional Song 1970",
        release: album.reference,
        album_title: album.title,
        track_no: 1,
      },
    ],
  })("Fictional Song 1970 (1970)");
  expect(parts.filter((part) => part.target).map((part) => [part.text, part.target?.kind])).toEqual(
    [
      ["Fictional Song 1970", "tracks"],
      ["1970", "year"],
    ],
  );
});
