import { expect, it } from "vitest";
import { biographyLinks } from "./biography-links";
it("links complete longest known names in the same catalogue without changing prose", () => {
  const artists = [
    { name: "Black Sabbath", reference: "artist:@phemios/server/black sabbath" },
    { name: "Sabbath", reference: "artist:@phemios/server/sabbath" },
    { name: "Black Sabbath", reference: "artist:@phemios/local/black sabbath" },
  ];
  const text = "Ozzy played in BLACK SABBATH. Sabbathical <b>remains text</b>.";
  const parts = biographyLinks(text, artists, "artist:@phemios/server/ozzy");
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(parts.filter((part) => part.reference).map((part) => part.reference)).toEqual([
    "artist:@phemios/server/black sabbath",
  ]);
});
it("does not guess ambiguous names or link the current artist", () => {
  expect(
    biographyLinks(
      "Signal and Signal North",
      [
        { name: "Signal", reference: "artist:signal" },
        { name: "Signal", reference: "artist:other" },
      ],
      "artist:signal",
    ).some((part) => part.reference),
  ).toBe(false);
});
