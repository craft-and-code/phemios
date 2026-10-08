import { it, expect } from "vitest";
import { parseTrackPage } from "./track-page";
it("preserves albumless tracks, distinct placements and exact page windows", () => {
  const row = {
    reference: "track:one",
    title: "Theme",
    release: null,
    album_title: null,
    disc_no: null,
    track_no: null,
    album_position: null,
    duration_ms: 1000,
    analysis_available: false,
    spectrum_available: false,
  };
  const page = { items: [row], total: 1, offset: 0, limit: 50, scanned_at: 10 };
  expect(parseTrackPage(page, 0).items[0]?.release).toBeNull();
  expect(() => parseTrackPage({ ...page, offset: 1 }, 0)).toThrow();
  expect(() => parseTrackPage({ ...page, items: [row, row], total: 2 }, 0)).toThrow();
  expect(() => parseTrackPage({ ...page, items: [{ ...row, duration_ms: -1 }] }, 0)).toThrow();
});
