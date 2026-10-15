import { expect, it, vi } from "vitest";
import { parentalRouteAllowed } from "./parental-route";
it("prevents detail resources from restarting while that source's policy is unavailable", () => {
  const available = vi.fn((source?: string) => source === "local");
  for (const kind of ["artist", "album", "track", "label"] as const) {
    expect(
      parentalRouteAllowed({ kind, reference: "track:@phemios/server/example" }, available),
    ).toBe(false);
    expect(
      parentalRouteAllowed({ kind, reference: "track:@phemios/local/example" }, available),
    ).toBe(true);
  }
});
it("keeps recovery settings accessible while blocking account views until admission recovers", () => {
  const available = vi.fn(() => false);
  expect(parentalRouteAllowed({ kind: "section", section: "settings" }, available)).toBe(true);
  expect(available).not.toHaveBeenCalled();
  expect(parentalRouteAllowed({ kind: "section", section: "tags" }, available)).toBe(false);
  expect(parentalRouteAllowed({ kind: "section", section: "playlists" }, () => true)).toBe(true);
});
