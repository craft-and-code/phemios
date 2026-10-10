import { it, expect } from "vitest";
import { needsCatalogPrompt } from "./catalog-prompt";
it("does not displace playback or request reconnection for connected albumless tracks", () => {
  expect(needsCatalogPrompt({ kind: "section", section: "playback" }, 0, true, false)).toBe(false);
  expect(needsCatalogPrompt({ kind: "section", section: "artists" }, 0, true, false)).toBe(false);
  expect(needsCatalogPrompt({ kind: "section", section: "artists" }, 0, false, false)).toBe(true);
  expect(needsCatalogPrompt({ kind: "track", reference: "track:one" }, 0, false, false)).toBe(
    false,
  );
  expect(needsCatalogPrompt({ kind: "section", section: "artists" }, 0, false, true)).toBe(false);
});
