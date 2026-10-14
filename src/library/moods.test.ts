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
it("accepts opt-in measured recipes without inventing personal tag criteria", () => {
  const page = {
    moods: [
      {
        rule: {
          id: "@aede/audio/slow",
          name: "Slow tempo",
          tags: [],
          genres: [],
          acoustic: "slow",
        },
        count: 1,
      },
    ],
    items: [
      {
        reference: "track:one",
        title: "First",
        release: null,
        number: 1,
        album_total: 1,
        reason: {
          tag: null,
          genre: null,
          scope: "acoustic",
          audio: { kind: "descriptor", value: 80, unit: "bpm" },
        },
      },
    ],
    total: 1,
    offset: 0,
    scanned_at: 1,
    selection_revision: "0123456789abcdef",
    acoustic: { profile: 1, ready: 1, missing: 0, cache_errors: 0, warming: false },
  };
  expect(parseMoods(page).moods[0]?.rule.acoustic).toBe("slow");
  expect(() =>
    parseMoods({
      ...page,
      moods: [{ rule: { ...page.moods[0]?.rule, acoustic: "fake" }, count: 1 }],
    }),
  ).toThrow();
});

it("refuses fabricated acoustic explanations and an invalid paging revision", () => {
  const item = {
    reference: "track:one",
    title: "First",
    release: null,
    number: 1,
    album_total: 1,
    reason: {
      tag: null,
      genre: null,
      scope: "acoustic",
      audio: { kind: "neighbor", distance: 0.1, examples: 2 },
    },
  };
  const page = { moods: [{ rule, count: 1 }], items: [item], total: 1, offset: 0, scanned_at: 1 };
  expect(parseMoods(page).items[0]?.reason.scope).toBe("acoustic");
  for (const reason of [
    { ...item.reason, audio: undefined },
    { ...item.reason, audio: { kind: "neighbor", distance: NaN, examples: 2 } },
    { ...item.reason, audio: { kind: "neighbor", distance: 0.1, examples: 1 } },
    { ...item.reason, tag: "someone else" },
    { ...item.reason, audio: { kind: "descriptor", value: 0, unit: "bpm" } },
  ])
    expect(() => parseMoods({ ...page, items: [{ ...item, reason }] })).toThrow();
  expect(() => parseMoods({ ...page, selection_revision: "wrong" })).toThrow();
});
