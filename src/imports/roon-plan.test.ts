import { expect, it } from "vitest";
import { readImportCsv } from "./csv";
import { additiveImportPatch, planRoonImport, suggestRoonMapping } from "./roon-plan";
import { albums, artists, annotation } from "./test-fixtures";
it("suggests album identity while keeping every personal field unmapped", () => {
  const mapping = suggestRoonMapping(["Artist", "Album", "Year", "Rating", "Tags", "Note"]);
  expect([mapping.artist, mapping.album, mapping.year]).toEqual([0, 1, 2]);
  expect([mapping.rating, mapping.tags, mapping.note, mapping.loved]).toEqual([-1, -1, -1, -1]);
  expect(mapping.favourites).toBe(false);
});
it("never chooses an ambiguous edition; explicit year resolves it and absent albums stay absent", () => {
  const table = readImportCsv(
    "Artist,Album,Year\nExample Artist,Aether,\nExample Artist,Aether,2001\nExample Artist,Missing,2000",
  );
  const rows = planRoonImport(
    table,
    { ...suggestRoonMapping(table.headers), favourites: true },
    albums,
    artists,
    {},
  );
  expect(rows.map((row) => row.status)).toEqual(["ambiguous", "ready", "missing"]);
  expect(rows[1]?.reference).toBe("release:a");
});
it("imports only explicitly chosen personal stars, note and additive tags", () => {
  const table = readImportCsv(
    'Artist,Album,Rating,Tags,Note\nEXAMPLE   ARTIST,Boreal,4,live;music,"my note"',
  );
  const mapping = { ...suggestRoonMapping(table.headers), rating: 2, tags: 3, note: 4 };
  const rows = planRoonImport(table, mapping, albums, artists, {
    "release:c": annotation("release:c", { tags: ["music", "old"] }),
  });
  expect(rows[0]?.status).toBe("ready");
  expect(
    additiveImportPatch(rows[0]!.desired!, annotation("release:c", { tags: ["music", "old"] })),
  ).toEqual({ rating: 4, note: "my note", tags: ["music", "old", "live"] });
  expect(
    additiveImportPatch(rows[0]!.desired!, annotation("release:c", { rating: 5 })),
  ).toBeUndefined();
  expect(
    additiveImportPatch(rows[0]!.desired!, annotation("release:c", { note: "keep me" })),
  ).toBeUndefined();
});
it("marks repeated destinations, invalid ratings and oversized tags rather than losing personal values", () => {
  const table = readImportCsv(
    "Artist,Album,Rating\nExample Artist,Boreal,4\nExample Artist,Boreal,5\nExample Artist,Aether,9",
  );
  const mapping = { ...suggestRoonMapping(table.headers), rating: 2 };
  expect(planRoonImport(table, mapping, albums, artists, {}).map((row) => row.status)).toEqual([
    "duplicate",
    "duplicate",
    "invalid",
  ]);
  expect(additiveImportPatch({ tags: ["é".repeat(129)] }, null)).toBeUndefined();
});
it("empty/zero/false exports do not clear existing values and columns cannot have multiple meanings", () => {
  expect(
    additiveImportPatch(
      {},
      annotation("release:c", { rating: 4, loved: true, note: "keep", tags: ["mine"] }),
    ),
  ).toEqual({});
  const table = readImportCsv("Artist,Album\nExample Artist,Boreal");
  expect(() =>
    planRoonImport(table, { ...suggestRoonMapping(table.headers), rating: 1 }, albums, artists, {}),
  ).toThrow();
  expect(
    planRoonImport(table, suggestRoonMapping(table.headers), albums, artists, {}).map(
      (row) => row.status,
    ),
  ).toEqual(["unchanged"]);
});
