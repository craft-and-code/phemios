import { expect, it } from "vitest";
import { advancedExpression, blankSearch, queueExpression, quoteQuery } from "./advanced-search";
it("keeps text literal rather than admitting operators or quotation injection", () => {
  expect(quoteQuery(`A "live" 'edition'`)).toBe(`"A "'"'"live"'"'" 'edition'"`);
  expect(advancedExpression({ ...blankSearch(), text: { title: "x OR loved" } })).toBe(
    'title:"x OR loved"',
  );
});
it("combines technical bounds and personal scopes without treating unknown depth as zero", () => {
  expect(
    advancedExpression({
      ...blankSearch(),
      scope: "album",
      formats: ["wav", "flac"],
      text: { tag: "music, live" },
      ranges: { bitdepth: ["24", "32"], size: ["1", ""], rating: ["2", "4"] },
    }),
  ).toContain('album.tag:"music" AND album.tag:"live"');
  expect(advancedExpression({ ...blankSearch(), ranges: { size: ["1", ""] } })).toBe(
    "size:1048576..",
  );
  expect(() =>
    advancedExpression({ ...blankSearch(), ranges: { year: ["2000", "1990"] } }),
  ).toThrow();
  expect(() => advancedExpression({ ...blankSearch(), ranges: { rating: ["0", "5"] } })).toThrow();
});
it("retains stable queue membership separately from repeated playlist occurrences", () => {
  expect(queueExpression(["track:one", "track:two", "track:one"])).toBe(
    'ref:="track:one" OR ref:="track:two"',
  );
});
