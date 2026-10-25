import { expect, it } from "vitest";
import { catalogRails } from "./rails";
it("never exposes catalog rails on an individual artist or album", () => {
  expect(catalogRails({ kind: "artist", reference: "artist:a" })).toBe(false);
  expect(catalogRails({ kind: "album", reference: "release:a" })).toBe(false);
  expect(catalogRails({ kind: "section", section: "artists" })).toBe(true);
  expect(catalogRails({ kind: "section", section: "tags" })).toBe(false);
  expect(catalogRails({ kind: "section", section: "history" })).toBe(false);
});
it("shares album rails with a pinned collection but not the collection manager or details", () => {
  expect(
    catalogRails({
      kind: "section",
      section: "collections",
      collectionMenu: "collection:11111111-1111-4111-8111-111111111111",
    }),
  ).toBe(true);
  expect(catalogRails({ kind: "section", section: "collections" })).toBe(false);
  expect(catalogRails({ kind: "album", reference: "album:fixture" })).toBe(false);
});
