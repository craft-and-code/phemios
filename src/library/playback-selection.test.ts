import { expect, it } from "vitest";
import { playbackSelection } from "./playback-selection";
const album = {
  reference: "release:one",
  title: "First",
  artist: null,
  year: 1990,
  compilation: false,
  tags: [],
};
it("retains the server order and per-album positions across a discography", () => {
  const rows = {
    items: [
      {
        reference: "track:b",
        title: "Second",
        release: album.reference,
        number: 2,
        album_total: 3,
      },
      { reference: "track:a", title: "First", release: album.reference, number: 1, album_total: 3 },
    ],
  };
  expect(playbackSelection(rows, [album], []).map((r) => r.number)).toEqual([2, 1]);
  expect(() => playbackSelection(rows, [], [])).toThrow(/resynchronisez/);
  rows.items[0]!.number = 4;
  expect(() => playbackSelection(rows, [album], [])).toThrow();
});
