import { expect, it } from "vitest";
import { m3uTitles } from "./m3u-preview";
it("previews extended names in order without exposing server paths as titles", () => {
  expect(
    m3uTitles("#EXTM3U\n#EXTINF:120,First\n/music/one.flac\n#EXTINF:180,Second\n/music/two.flac\n"),
  ).toEqual(["First", "Second"]);
  expect(() => m3uTitles("garbage")).toThrow();
});

it("previews BOM CRLF and paths-only folder playlists without interpreting their paths", () => {
  expect(m3uTitles("\uFEFF#EXTM3U\r\n#EXTINF:120,First\r\n./one.flac\r\n")).toEqual(["First"]);
  expect(m3uTitles("./one.flac\r\n# comment\r\nC:\\Music\\two.mp3\r\n", true)).toEqual([
    "one.flac",
    "two.mp3",
  ]);
  expect(m3uTitles("#EXTM3U\n#EXTINF:12,\n./untitled.flac\n", true)).toEqual(["untitled.flac"]);
  expect(m3uTitles("\n# empty\n", true)).toEqual([]);
  expect(() => m3uTitles("one.flac\0two.flac", true)).toThrow();
  expect(() =>
    m3uTitles(Array.from({ length: 4097 }, () => "one.flac").join("\n"), true),
  ).toThrow();
});
