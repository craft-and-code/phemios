import { expect, it } from "vitest";
import { moodName, parseMoods } from "./moods";
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
