import { expect, it } from "vitest";
import { catalogRails } from "./rails";
it("never exposes catalog rails on an individual artist or album", () => {
  expect(catalogRails({ kind: "artist", reference: "artist:a" })).toBe(false);
  expect(catalogRails({ kind: "album", reference: "release:a" })).toBe(false);
  expect(catalogRails({ kind: "section", section: "artists" })).toBe(true);
  expect(catalogRails({ kind: "section", section: "tags" })).toBe(false);
  expect(catalogRails({ kind: "section", section: "history" })).toBe(false);
});
