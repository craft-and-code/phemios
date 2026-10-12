import { expect, it } from "vitest";
import { parseM3UDetail, parseM3UPage } from "./m3u-files";
const id = `m3u-file-${"a".repeat(64)}`;
const row = {
  id,
  name: "Artist collection",
  filename: "Artist collection.m3u8",
  path: "/music/artist/Artist collection.m3u8",
  track_count: null,
};
const page = { items: [row], total: 1, offset: 0, unavailable_roots: 0, unreadable_directories: 0 };
it("keeps unknown counts distinct and refuses wrong metadata or duplicated selectors", () => {
  expect(parseM3UPage(page, 0, "files").items[0]?.track_count).toBeNull();
  for (const patch of [
    { offset: 50 },
    { total: -1 },
    { unavailable_roots: -1 },
    { items: [row, row] },
    { items: [{ ...row, track_count: 0 }] },
    { items: [{ ...row, id: "playlist-a" }] },
  ])
    expect(() => parseM3UPage({ ...page, ...patch }, 0, "files")).toThrow();
});
it("keeps exact simple file text but validates its target and parsed count", () => {
  const file = { ...row, track_count: 2, content: "\uFEFFone.flac\r\n# ignored\r\ntwo.mp3\r\n" };
  expect(parseM3UDetail(file, id, "files")).toMatchObject({
    content: file.content,
    titles: ["one.flac", "two.mp3"],
  });
  for (const patch of [
    { id: `m3u-file-${"b".repeat(64)}` },
    { track_count: 3 },
    { content: "one\0.flac" },
  ])
    expect(() => parseM3UDetail({ ...file, ...patch }, id, "files")).toThrow();
});
