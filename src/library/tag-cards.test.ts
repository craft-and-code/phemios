import { expect, it } from "vitest";
import { cachedTagCard, parseTagCard } from "./tag-cards";
import { taggedEntries, taggedTrackWindow } from "./tag-catalog";
it("keeps every tagged artist album and track in the same result window, including missing cache entries", async () => {
  const rows = [
    "artist:@phemios/server/singer",
    "release:@phemios/server/album",
    "track:@phemios/server/title",
  ].map((reference) => ({ reference, tags: ["music"], note: null, rating: null, loved: false }));
  const entries = taggedEntries(rows, "music", "");
  const cards = await taggedTrackWindow(
    entries.map((row) => row.reference),
    0,
    async (reference) => parseTagCard({ reference, name: "Resolved" }, reference),
  );
  expect(cards).toHaveLength(3);
  expect(cards.map((row) => row.reference)).toEqual(rows.map((row) => row.reference));
  expect(cachedTagCard(rows[0]!.reference, [], [])).toBeUndefined();
  expect(
    parseTagCard({ reference: rows[0]!.reference, name: "Singer" }, rows[0]!.reference).label,
  ).toBe("Singer");
  expect(() =>
    parseTagCard({ reference: "artist:other", name: "Other" }, rows[0]!.reference),
  ).toThrow();
});
