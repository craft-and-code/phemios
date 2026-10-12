import { expect, it } from "vitest";
import { readImportCsv } from "./csv";
it("reads UTF-8 BOM, CRLF, quoted delimiters, multiline notes and escaped quotes", () => {
  expect(readImportCsv('\ufeffArtist;Album;Note\r\nExample;"A;B";"one\n""two"""\r\n')).toEqual({
    headers: ["Artist", "Album", "Note"],
    rows: [["Example", "A;B", 'one\n"two"']],
  });
  expect(readImportCsv("Artist\tAlbum\nExample\tAether").rows).toEqual([["Example", "Aether"]]);
});
it("refuses malformed, ragged, duplicate or excessively large files rather than shifting fields", () => {
  for (const value of [
    'Artist,Album\nA,"unfinished',
    'Artist,Album\n"A"x,B',
    "Artist,Album\nA,B,C",
    "Artist,Artist\nA,B",
    "Artist,Album\nA,B\u0000",
  ])
    expect(() => readImportCsv(value)).toThrow();
  expect(() => readImportCsv("a,b\n" + "a,b\n".repeat(5001))).toThrow();
  expect(() => readImportCsv("a,b\n" + "x".repeat(17000) + ",b")).toThrow();
});
