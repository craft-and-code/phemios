import { expect, it } from "vitest";
import { neighbours } from "./relations";
import type { Artist } from "./types";
const artist = (reference: string): Artist => ({
  reference,
  name: reference,
  genre: "",
  country: null,
  biography: "",
  artwork: false,
});
it("bounds discovery, removes dangling/self edges and retains credited provenance", () => {
  const center = artist("center"),
    others = Array.from({ length: 100 }, (_, i) => artist(`guest:${i}`));
  center.relations = [...others, center, artist("absent")].map((a, i) => ({
    reference: a.reference,
    name: a.name,
    weight: i,
    kind: "collaborated",
    source: "tags",
  }));
  const rows = neighbours([center, ...others], center);
  expect(rows).toHaveLength(16);
  expect(rows[0]?.artist.reference).toBe("guest:99");
  expect(rows.every((row) => row.source === "tags" && row.kind === "collaborated")).toBe(true);
});
it("deduplicates opposite representations and does not infer band membership", () => {
  const center = artist("center"),
    guest = artist("guest");
  center.relations = [1, 3].map((weight) => ({
    reference: "guest",
    name: "guest",
    weight,
    kind: "collaborated",
    source: "tags",
  }));
  expect(neighbours([center, guest], center)).toEqual([
    { artist: guest, weight: 3, kind: "collaborated", source: "tags" },
  ]);
});
