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
