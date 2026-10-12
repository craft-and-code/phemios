import { expect, it } from "vitest";
import { playbackLayers, playbackWords } from "./layers";
it("shows requested frequencies with no scene selected", () => {
  expect(playbackLayers("off", true, true)).toEqual({ canvas: false, frequencies: true });
});
it("keeps unavailable or explicitly hidden frequency data out of the stage", () => {
  expect(playbackLayers("sphere", false, true).frequencies).toBe(false);
  expect(playbackLayers("off", true, false).frequencies).toBe(false);
});

it("hides ordinary lyrics without hiding an independently selected floating treatment", () => {
  for (const scene of ["off", "sphere", "waves", "landscape"] as const) {
    expect(playbackWords(scene, true)).toBe(true);
    expect(playbackWords(scene, false)).toBe(false);
  }
  expect(playbackWords("floating", false)).toBe(true);
  expect(playbackWords("floating", true)).toBe(true);
});
