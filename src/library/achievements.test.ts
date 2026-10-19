import { expect, it } from "vitest";
import { parseAchievements } from "./achievements";
it("keeps locked entries opaque and rejects leaks, duplicate slots and invented counts", () => {
  const value = { items: [{ slot: 0, unlocked_at: null }], total: 1, unlocked: 0 };
  expect(parseAchievements(value)).toEqual(value);
  for (const change of [
    { items: [{ slot: 0, unlocked_at: null, title: { fr: "Secret", en: "Secret" } }] },
    { unlocked: 1 },
    { items: [...value.items, ...value.items], total: 2 },
  ])
    expect(() => parseAchievements({ ...value, ...change })).toThrow();
  expect(
    parseAchievements({
      items: [
        {
          slot: 0,
          unlocked_at: 2,
          title: { fr: "A", en: "A" },
          description: { fr: "B", en: "B" },
          icon: "heart",
        },
      ],
      total: 1,
      unlocked: 1,
    }).unlocked,
  ).toBe(1);
});

it("rejects unlock timestamps that would crash the date formatter", () => {
  const unlocked = (at: number) => ({
    items: [
      {
        slot: 0,
        unlocked_at: at,
        title: { fr: "A", en: "A" },
        description: { fr: "B", en: "B" },
        icon: "heart",
      },
    ],
    total: 1,
    unlocked: 1,
  });
  for (const at of [8_640_000_000_001, Number.MAX_SAFE_INTEGER]) {
    expect(() => new Intl.DateTimeFormat("fr").format(at * 1000)).toThrow();
    expect(() => parseAchievements(unlocked(at))).toThrow(/invalides/);
  }
  for (const at of [0, 1, 8_640_000_000_000]) {
    const accepted = parseAchievements(unlocked(at));
    expect(() =>
      new Intl.DateTimeFormat("fr").format(accepted.items[0]!.unlocked_at! * 1000),
    ).not.toThrow();
  }
});
