import { expect, it } from "vitest";
import { playbackLayers } from "./layers";
it("shows requested frequencies with no scene selected", () => {
  expect(playbackLayers("off", true, true)).toEqual({ canvas: false, frequencies: true });
});
it("keeps unavailable or explicitly hidden frequency data out of the stage", () => {
  expect(playbackLayers("sphere", false, true).frequencies).toBe(false);
  expect(playbackLayers("off", true, false).frequencies).toBe(false);
});
