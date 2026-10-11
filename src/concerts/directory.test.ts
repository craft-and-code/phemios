import { expect, it, vi } from "vitest";
import { collectConcerts, readConcertCache, retainConcerts, concertArtists } from "./directory";
const event = {
  id: "one",
  title: "Example Live",
  url: null,
  date: "2027-05-02",
  time: null,
  timezone: null,
  status: "onsale",
  venue: "Hall",
  city: "Paris",
  country: "France",
  countryCode: "FR",
  address: null,
  info: null,
  notice: null,
  price: null,
};
it("paginates in order, deduplicates events and marks bounded searches partial", async () => {
  const request = vi.fn(async (_name: string, page: number) => ({
    source: "Ticketmaster Discovery",
    page,
    pages: 12,
    artistId: "one",
    items: [{ ...event, id: String(page) }],
  }));
  const result = await collectConcerts("Example Artist", () => true, request);
  expect(request).toHaveBeenCalledTimes(10);
  expect(result?.events).toHaveLength(10);
  expect(result?.partial).toBe(true);
});
it("cancels replaced views and refuses inconsistent performer identities", async () => {
  const request = vi.fn(async (_name: string, page: number) => ({
    source: "Ticketmaster Discovery",
    page,
    pages: 2,
    artistId: String(page),
    items: [event],
  }));
  expect(await collectConcerts("Example Artist", () => false, request)).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
  await expect(collectConcerts("Example Artist", () => true, request)).rejects.toThrow(/ambigu/);
});
it("keeps prior completed artist caches when retaining another and refuses corrupt stores", () => {
  let raw: string | null = null;
  const store = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  retainConcerts(store, { artist: "First", events: [event], partial: false, at: 1 });
  retainConcerts(store, { artist: "Second", events: [], partial: false, at: 2 });
  expect(readConcertCache(store).map((row) => row.artist)).toEqual(["Second", "First"]);
  raw = "broken";
  expect(() =>
    retainConcerts(store, { artist: "Third", events: [], partial: false, at: 3 }),
  ).toThrow();
  expect(raw).toBe("broken");
});
it("groups the same principal across local and remote origins without adding guest-only musicians", () => {
  const base = { name: "Example Artist", genre: "", country: null, biography: "", artwork: false };
  expect(
    concertArtists(
      [
        { ...base, reference: "artist:a" },
        { ...base, reference: "local:artist:a" },
        { ...base, name: "Guest", reference: "artist:guest" },
      ],
      [
        {
          reference: "release:a",
          artist: "artist:a",
          title: "First",
          year: 2000,
          compilation: false,
          tags: [],
        },
        {
          reference: "local:release:a",
          artist: "local:artist:a",
          title: "Second",
          year: 2001,
          compilation: false,
          tags: [],
        },
      ],
    ),
  ).toEqual([{ name: "Example Artist", references: ["artist:a", "local:artist:a"] }]);
});
