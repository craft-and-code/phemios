import { expect, it } from "vitest";
import { parseTrackDetail } from "./track-detail";
it("preserves albumless metadata, tags and credited sources while refusing malformed facts", () => {
  const row = {
    reference: "track:solo",
    title: "Solo",
    release: null,
    disc_no: null,
    track_no: 1,
    size: 10,
    duration_ms: null,
    path: "/music/solo.flac",
    spectrum_available: false,
    analyses: [],
    properties: {
      codec: "flac",
      container: "flac",
      sample_rate: 48000,
      bit_depth: 24,
      channels: 2,
      bitrate_kbps: null,
      lossless: true,
    },
    tags: { mood: ["electric"] },
    credits: [{ reference: "artist:one", name: "One", role: "guitar", source: "tags" }],
  };
  expect(parseTrackDetail(row, row.reference).credits[0]?.source).toBe("tags");
  expect(parseTrackDetail(row, row.reference).release).toBeNull();
  expect(parseTrackDetail(row, row.reference).lyrics_available).toBeUndefined();
  expect(parseTrackDetail({ ...row, lyrics_available: true }, row.reference).lyrics_available).toBe(
    true,
  );
  expect(() => parseTrackDetail({ ...row, lyrics_available: "yes" }, row.reference)).toThrow();
  expect(() => parseTrackDetail({ ...row, size: -1 }, row.reference)).toThrow();
  expect(() =>
    parseTrackDetail({ ...row, properties: { ...row.properties, channels: "two" } }, row.reference),
  ).toThrow();
  expect(() => parseTrackDetail({ ...row, tags: { mood: [false] } }, row.reference)).toThrow();
  expect(() => parseTrackDetail(row, "track:other")).toThrow();
});
