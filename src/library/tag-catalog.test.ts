import { expect, it, vi } from "vitest";
import { tagCatalog, taggedEntries, taggedTrackWindow } from "./tag-catalog";
import { selectTags } from "./selection";
import type { Annotation } from "./server";
const row = (reference: string, tags: string[]): Annotation => ({
  reference,
  tags,
  loved: false,
  rating: null,
  note: null,
});
it("combines selected tags across artists, albums and tracks without duplicate cards", () => {
  const rows = [
    row("artist:a", ["Singer"]),
    row("release:a", ["music", "singer"]),
    row("track:a", ["live"]),
  ];
  expect(taggedEntries(rows, ["SINGER", "MUSIC"], "")).toEqual(rows.slice(0, 2));
  expect(selectTags(["SINGER"], "MUSIC", true)).toEqual(["SINGER", "MUSIC"]);
  expect(selectTags(["SINGER", "MUSIC"], "SINGER", true)).toEqual(["MUSIC"]);
  expect(selectTags(["SINGER"], "MUSIC", false)).toEqual(["MUSIC"]);
  expect(selectTags(["SINGER"], undefined, false)).toEqual([]);
});
it("counts each tagged identity once and preserves both catalogs and first tag spelling", () => {
  const rows = [
    row("release:@phemios/local/a", ["Music", "MUSIC"]),
    row("release:@phemios/server/a", ["music"]),
    row("track:t", ["cinéma"]),
    undefined,
  ];
  expect(tagCatalog(rows)).toEqual([
    { key: "CINEMA", label: "cinéma", count: 1 },
    { key: "MUSIC", label: "Music", count: 2 },
  ]);
  expect(taggedEntries(rows, "music", "mu").map((r) => r.reference)).toEqual([
    "release:@phemios/local/a",
    "release:@phemios/server/a",
  ]);
  expect(taggedEntries(rows, "", "cinema").map((r) => r.reference)).toEqual(["track:t"]);
  expect(tagCatalog([undefined, row("artist:a", [])])).toEqual([]);
});
it("updates immediately when a tag is removed and never infers an artist's albums", () => {
  expect(
    taggedEntries([row("artist:a", ["live"]), row("release:a", [])], "live", "").map(
      (r) => r.reference,
    ),
  ).toEqual(["artist:a"]);
  expect(taggedEntries([row("artist:a", [])], "live", "")).toEqual([]);
});
it("reads only ten visible track identities with two concurrent requests and explicit failures", async () => {
  let pending = 0,
    max = 0;
  const read = vi.fn(async (reference: string) => {
    max = Math.max(max, ++pending);
    await Promise.resolve();
    pending--;
    if (reference === "track:12") throw new Error("missing");
    return { reference, title: reference };
  });
  const refs = Array.from({ length: 100 }, (_, i) => `track:${i}`);
  const result = await taggedTrackWindow(refs, 10, read);
  expect(read.mock.calls.map((r) => r[0])).toEqual(refs.slice(10, 20));
  expect(max).toBe(2);
  expect(result[2]).toEqual({ reference: "track:12", error: "Error: missing" });
  expect(result[9]).toEqual({
    reference: "track:19",
    track: { reference: "track:19", title: "track:19" },
  });
});

it("stops admitting tagged detail reads when its visible window is retired", async () => {
  let current = true;
  const releases: (() => void)[] = [];
  const read = vi.fn(() => new Promise<string>((done) => releases.push(() => done("old"))));
  const pending = taggedTrackWindow(
    ["track:one", "track:two", "track:three"],
    0,
    read,
    () => current,
  );
  expect(read).toHaveBeenCalledTimes(2);
  current = false;
  for (const release of releases.slice()) release();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(2);
  await pending;
});
