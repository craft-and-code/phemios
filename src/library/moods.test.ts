import { expect, it } from "vitest";
import { moodName, moodReason, parseMoods } from "./moods";
const rule = { id: "energy", name: "Energy", tags: ["sport"], genres: [] };
it("preserves a renamed starter atmosphere instead of replacing its name with a translation", () => {
  expect(moodName({ ...rule, name: "My workout" })).toBe("My workout");
});
it("validates bounded mood criteria and exact track explanation rather than inventing evidence", () => {
  const page = {
    moods: [{ rule, count: 1 }],
    items: [
      {
        reference: "track:one",
        title: "First",
        release: null,
        number: 1,
        album_total: 1,
        reason: { tag: "sport", genre: null },
      },
    ],
    total: 1,
    offset: 0,
    scanned_at: 1,
  };
  expect(parseMoods(page).items[0]?.reason.tag).toBe("sport");
  expect(() =>
    parseMoods({
      ...page,
      moods: [{ rule: { ...rule, tags: Array(33).fill("sport") }, count: 1 }],
    }),
  ).toThrow();
  expect(() =>
    parseMoods({ ...page, items: [{ ...page.items[0], reason: { tag: 7, genre: null } }] }),
  ).toThrow();
});

it("accepts specific evidence from new servers and preserves older reason explanations", () => {
  expect(moodReason({ tag: "calm", genre: null, scope: "track" })).toBe("Tag de la piste : calm");
  expect(moodReason({ tag: "calm", genre: null, scope: "album" })).toBe("Tag de l’album : calm");
  expect(moodReason({ tag: "calm", genre: null, scope: "artist" })).toBe("Tag de l’artiste : calm");
  expect(moodReason({ tag: "calm", genre: null })).toBe("Tag : calm");
  expect(moodReason({ tag: null, genre: "ambient", scope: "genre" })).toBe("Genre : ambient");
  const page = {
    moods: [{ rule, count: 1 }],
    items: [
      {
        reference: "track:one",
        title: "First",
        release: null,
        number: 1,
        album_total: 1,
        reason: { tag: "calm", genre: null, scope: "track" },
      },
    ],
    total: 1,
    offset: 0,
    scanned_at: 1,
  };
  expect(parseMoods(page).items[0]?.reason.scope).toBe("track");
  expect(() =>
    parseMoods({
      ...page,
      items: [{ ...page.items[0], reason: { tag: "calm", genre: null, scope: "guest" } }],
    }),
  ).toThrow();
});
