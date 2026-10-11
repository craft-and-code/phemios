import { expect, it } from "vitest";
import { historyTrackAction } from "./history-actions";
it("opens and plays the visited track rather than its album, including albumless visits", () => {
  for (const release of ["release:album", null]) {
    expect(historyTrackAction({ track: "track:@phemios/local/song", release })).toEqual({
      href: "#/track/track%3A%40phemios%2Flocal%2Fsong",
      reference: "track:@phemios/local/song",
      disabled: false,
    });
  }
});
it("retains unavailable visit identity while disabling replay", () => {
  expect(
    historyTrackAction({ track: "track:missing", release: null, error: "Unavailable" }).disabled,
  ).toBe(true);
});
