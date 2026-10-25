import { afterEach, expect, it, vi } from "vitest";
import { browserNavigationHost } from "./history";

afterEach(() => vi.unstubAllGlobals());

it("captures the artist-card viewport rather than its non-scrolling shell", () => {
  const cards = { scrollTop: 1280 };
  const main = { scrollTop: 0, querySelector: () => cards };
  vi.stubGlobal("document", { getElementById: () => main });
  expect(browserNavigationHost().top()).toBe(1280);
});

it("uses the ordinary main viewport when no primary nested catalogue is declared", () => {
  const main = { scrollTop: 720, querySelector: () => null };
  vi.stubGlobal("document", { getElementById: () => main });
  expect(browserNavigationHost().top()).toBe(720);
});

it("resolves the current viewport again after changing catalogue presentation", () => {
  let nested: { scrollTop: number } | null = { scrollTop: 1280 };
  const main = { scrollTop: 720, querySelector: () => nested };
  vi.stubGlobal("document", { getElementById: () => main });
  const host = browserNavigationHost();
  expect(host.top()).toBe(1280);
  nested = null;
  expect(host.top()).toBe(720);
});
