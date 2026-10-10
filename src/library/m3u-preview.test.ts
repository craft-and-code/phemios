import { expect, it } from "vitest";
import { m3uTitles } from "./m3u-preview";
it("previews extended names in order without exposing server paths as titles", () => {
  expect(
    m3uTitles("#EXTM3U\n#EXTINF:120,First\n/music/one.flac\n#EXTINF:180,Second\n/music/two.flac\n"),
  ).toEqual(["First", "Second"]);
  expect(() => m3uTitles("garbage")).toThrow();
});
