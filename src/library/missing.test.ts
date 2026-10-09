import { expect, it } from "vitest";
import { parseMissing, missingAlbum } from "./missing";
it("keeps external missing albums separate from owned editions and refuses malformed identities", () => {
  const raw = {
    artist: "artist:@phemios/server/signal",
    artist_name: "Signal",
    release_group: "12345678-1234-1234-1234-123456789abc",
    title: "Third",
    year: 2003,
    set_aside: false,
    source: "musicbrainz",
    url: "https://musicbrainz.org/release-group/12345678-1234-1234-1234-123456789abc",
  };
  const row = parseMissing(raw);
  expect(missingAlbum(row).artist).toBe(raw.artist);
  expect(missingAlbum(row).reference).not.toMatch(/^release:/);
  expect(() => parseMissing({ ...raw, release_group: "../../file" })).toThrow();
  expect(() => parseMissing({ ...raw, artist: "track:wrong" })).toThrow();
});
