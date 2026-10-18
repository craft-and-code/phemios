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

it("cycles one spectrum control through gradient, terminal and hidden", async () => {
  const { nextFrequencyMode } = await import("./layers");
  expect(nextFrequencyMode(false, "terminal")).toEqual({ visible: true, style: "gradient" });
  expect(nextFrequencyMode(true, "gradient")).toEqual({ visible: true, style: "terminal" });
  expect(nextFrequencyMode(true, "terminal")).toEqual({ visible: false, style: "terminal" });
});

it("lets floating words be hidden and restored independently of ordinary lyrics", () => {
  expect(playbackWords("floating", true, false)).toBe(false);
  expect(playbackWords("floating", false, true)).toBe(true);
  expect(playbackWords("sphere", false, true)).toBe(false);
  expect(playbackWords("sphere", true, false)).toBe(true);
});
