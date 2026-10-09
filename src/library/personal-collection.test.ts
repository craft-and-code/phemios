import { expect, it } from "vitest";
import { personalCollectionExpression } from "./personal-collection";
it("retains inclusive stars and query without activating unrelated catalog rails", () => {
  expect(JSON.parse(personalCollectionExpression("rated", "Metal", 2, 4).slice(10))).toEqual({
    view: "rated",
    mode: "none",
    years: [0, 9999],
    alphabet: [0, 26],
    includeUnknownYear: true,
    query: "Metal",
    ratings: [2, 4],
  });
  expect(JSON.parse(personalCollectionExpression("favourites", "").slice(10))).not.toHaveProperty(
    "ratings",
  );
});
