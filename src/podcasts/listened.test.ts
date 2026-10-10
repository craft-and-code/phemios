import { expect, it } from "vitest";
import { createListenedEpisodes, episodeListened } from "./listened";
it("persists independent feed identities, retains duplicate evidence and refuses corrupt stores", () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const first = createListenedEpisodes(storage);
  first.mark("https://example.org/a.xml", "same");
  first.mark("https://example.org/a.xml", "same");
  const restored = createListenedEpisodes(storage);
  expect(restored.has("https://example.org/a.xml", "same")).toBe(true);
  expect(restored.has("https://example.org/b.xml", "same")).toBe(false);
  raw = "broken";
  restored.mark("https://example.org/b.xml", "new");
  expect(raw).toBe("broken");
  expect(restored.error()).not.toBe("");
  expect(restored.has("https://example.org/b.xml", "new")).toBe(false);
});
it("unions actual intervals and rejects end seeks, unknown duration and invalid intervals", () => {
  expect(
    episodeListened(
      [
        [0, 45],
        [30, 90],
      ],
      100,
    ),
  ).toBe(true);
  expect(episodeListened([[95, 100]], 100)).toBe(false);
  expect(
    episodeListened(
      [
        [0, 50],
        [0, 50],
      ],
      100,
    ),
  ).toBe(false);
  expect(episodeListened([[0, 100]], NaN)).toBe(false);
  expect(
    episodeListened(
      [
        [-10, 100],
        [0, 1000],
      ],
      100,
    ),
  ).toBe(false);
});
