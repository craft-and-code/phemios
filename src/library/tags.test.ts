import { expect, it } from "vitest";
import { commitTags, tagSuggestions, tagVocabulary } from "./tags";
import type { Annotation } from "./server";
it("commits comma or Enter input as trimmed distinct tokens without empty pills", () => {
  expect(commitTags(["music"], " Music, live ,, jazz ")).toEqual(["music", "live", "jazz"]);
  expect(commitTags([], " cinéma ")).toEqual(["cinéma"]);
});
it("suggests only previously saved current-account tags and excludes selected tokens", () => {
  const row: Annotation = {
    reference: "artist:a",
    rating: null,
    loved: false,
    note: null,
    tags: ["music", "Musique", "Jazz"],
  };
  const vocabulary = tagVocabulary([row, undefined, { ...row, tags: ["music"] }]);
  expect(tagSuggestions(vocabulary, "mu", ["music"])).toEqual(["Musique"]);
  expect(tagSuggestions(vocabulary, "ja", [])).toEqual(["Jazz"]);
  expect(tagVocabulary([])).toEqual([]);
  expect(tagSuggestions(vocabulary, "", [])).toEqual([]);
});
it("bounds suggestions and preserves entered/saved spelling", () => {
  expect(
    tagSuggestions(
      Array.from({ length: 20 }, (_, i) => `music ${i}`),
      "mu",
      [],
    ),
  ).toHaveLength(8);
  expect(commitTags(["Rock"], "rock")).toEqual(["Rock"]);
});
