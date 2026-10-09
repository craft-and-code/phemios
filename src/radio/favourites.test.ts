import { expect, it } from "vitest";
import { createRadioFavourites, readRadioFavourites } from "./favourites";
const selected = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Owned Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
it("restores stations without resolving a stream and removes only the selected favourite", () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const fav = createRadioFavourites(storage);
  fav.toggle({ ...selected, url: "https://do-not-store.test", token: "secret" } as typeof selected);
  expect(raw).not.toContain("do-not-store");
  expect(raw).not.toContain("secret");
  expect(readRadioFavourites(storage)).toEqual([selected]);
  const restored = createRadioFavourites(storage);
  expect(restored.has(selected.uuid)).toBe(true);
  restored.toggle(selected);
  expect(readRadioFavourites(storage)).toEqual([]);
});
it("preserves unreadable favourites and reports a refused write without a false heart", () => {
  let writes = 0;
  const bad = createRadioFavourites({
    getItem: () => "bad",
    setItem: () => {
      writes++;
    },
  });
  bad.toggle(selected);
  expect(writes).toBe(0);
  expect(bad.error()).not.toBe("");
  const refused = createRadioFavourites({
    getItem: () => null,
    setItem: () => {
      throw new Error("Full");
    },
  });
  refused.toggle(selected);
  expect(refused.has(selected.uuid)).toBe(false);
  expect(refused.error()).toContain("Full");
});
