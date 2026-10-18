import { expect, it } from "vitest";
import { queueSearch, moodSearch } from "./personal-search";
it("filters queue occurrences by visible metadata without losing identities or matching internal IDs", () => {
  const rows = [
    {
      index: 9,
      reference: "track:secret13",
      title: "Été",
      artist: "Example Singer",
      album: { title: "Morning" },
    },
    {
      index: 2,
      reference: "track:other",
      title: "Daybreak",
      artist: "The Northern Lights",
      album: { title: "13" },
    },
    {
      index: 7,
      reference: "track:other",
      title: "Daybreak",
      artist: "The Northern Lights",
      album: { title: "13" },
    },
  ];
  expect(queueSearch(rows, "13")).toEqual([rows[1], rows[2]]);
  expect(queueSearch(rows, "ete")).toEqual([rows[0]]);
  expect(queueSearch(rows, "northern")).toEqual([rows[1], rows[2]]);
  expect(queueSearch(rows, " ")).toEqual(rows);
  expect(queueSearch(rows, "absent")).toEqual([]);
  expect(rows.map((r) => r.index)).toEqual([9, 2, 7]);
});
it("matches mood names, tags and genres without using internal identifiers", () => {
  const row = { id: "internal13", name: "Évasion", tags: ["Détente"], genres: ["Ambient"] };
  expect(moodSearch(row, "evasion")).toBe(true);
  expect(moodSearch(row, "detente")).toBe(true);
  expect(moodSearch(row, "ambient")).toBe(true);
  expect(moodSearch(row, "13")).toBe(false);
});
