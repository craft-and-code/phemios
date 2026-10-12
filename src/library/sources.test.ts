import { it, expect } from "vitest";
import { referenceSource } from "./sources";
it("distinguishes colliding identities and legacy remote cache", () => {
  expect(referenceSource("artist:@phemios/local/signal")).toBe("local");
  expect(referenceSource("artist:@phemios/server/signal")).toBe("server");
  expect(referenceSource("artist:signal")).toBe("server");
});

it("keeps owner markers inside literal engine keys from changing catalog ownership", () => {
  const key = "/music/artist:@phemios/local/unrelated/fixture.flac";
  expect(referenceSource(`track:${key}`)).toBe("server");
  expect(referenceSource(`track:@phemios/server/${key}`)).toBe("server");
  expect(referenceSource(`track:@phemios/local/${key}`)).toBe("local");
  for (const kind of [
    "artist",
    "release",
    "track",
    "recording",
    "work",
    "release_group",
    "label",
    "genre",
  ]) {
    expect(referenceSource(`${kind}:@phemios/local/fixture`)).toBe("local");
    expect(referenceSource(`${kind}:@phemios/server/fixture`)).toBe("server");
    expect(referenceSource(`${kind}:fixture`)).toBe("server");
  }
});
