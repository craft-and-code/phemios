import { expect, it } from "vitest";
import { demoRequest } from "./demo-api";
import { demoSnapshot, demoMedia, demoMusic } from "./catalog";
import { parseSnapshot } from "../library/server";
import { parseTrackDetail } from "../library/track-detail";
import { parseWaveform } from "../library/waveform";
const server = "https://demo.example/web-demo";
it("provides attributed real music through the existing catalogue, track and waveform contracts", () => {
  const snapshot = parseSnapshot(demoSnapshot(server));
  expect(snapshot.albums).toHaveLength(10);
  expect(snapshot.artists.map((a) => a.name)).toEqual(["Scott Buckley", "Chris Zabriskie"]);
  for (const track of snapshot.tracks!) {
    expect(
      parseTrackDetail(
        demoRequest("/api/v1/track", { ref: track.reference }, "GET", null, server),
        track.reference,
      ).properties.codec,
    ).toBe(
      demoMusic.find((m) => `track:web-demo-${m.id}` === track.reference)?.file.endsWith(".mp3")
        ? "mp3"
        : "aac",
    );
    expect(
      parseWaveform(
        demoRequest("/api/v1/waveform", { ref: track.reference }, "GET", null, server),
        track.reference,
      ).peaks.length,
    ).toBeLessThanOrEqual(1024);
    expect(demoMedia(track.reference)).toMatch(/web-demo\/audio\/[a-z]+\.(mp3|m4a)$/);
  }
  expect(() => demoMedia("track:outside")).toThrow();
});
it("a track addition selects one track while artist playback keeps the curated order", () => {
  const one = demoRequest(
    "/api/v1/presentation/playback",
    { ref: "track:web-demo-hiraeth" },
    "GET",
    null,
    server,
  ) as { items: unknown[] };
  const artist = demoRequest(
    "/api/v1/presentation/playback",
    { ref: "artist:web-demo-scott" },
    "GET",
    null,
    server,
  ) as { items: unknown[] };
  expect(one.items).toHaveLength(1);
  expect(artist.items).toHaveLength(7);
});

it("partial annotation updates retain a demo owner's other personal fields", () => {
  const ref = "release:web-demo-hiraeth";
  demoRequest(
    "/api/me/v1/annotation",
    {},
    "PUT",
    { reference: ref, note: "Keep this note", rating: 4 },
    server,
  );
  demoRequest("/api/me/v1/annotation", {}, "PUT", { reference: ref, loved: true }, server);
  expect(demoRequest("/api/me/v1/annotation", { ref }, "GET", null, server)).toEqual({
    reference: ref,
    annotation: { reference: ref, loved: true, note: "Keep this note", rating: 4, tags: [] },
  });
});

it("keeps author playback, release selection, search and credits distinct across the two musicians", () => {
  const items = (path: string, query: Record<string, string>) =>
    (
      demoRequest(path, query, "GET", null, server) as {
        items: { reference: string; release?: string }[];
      }
    ).items;
  const chris = items("/api/v1/presentation/playback", { ref: "artist:web-demo-chris" });
  expect(chris.map((t) => t.reference)).toEqual([
    "track:web-demo-cylinderone",
    "track:web-demo-kaleetan",
    "track:web-demo-heliograph",
  ]);
  expect(
    items("/api/v1/presentation/playback", { ref: "release:web-demo-cylinderone" }).map(
      (t) => t.reference,
    ),
  ).toEqual(["track:web-demo-cylinderone"]);
  expect(items("/api/v1/presentation/tracks", { q: "Zabriskie" }).map((t) => t.reference)).toEqual(
    chris.map((t) => t.reference),
  );
  expect(items("/api/v1/presentation/albums", { q: "Cylinders" })).toHaveLength(1);
  expect(items("/api/v1/presentation/tracks", { q: "Sabbath" })).toEqual([]);
  const detail = parseTrackDetail(
    demoRequest("/api/v1/track", { ref: "track:web-demo-cylinderone" }, "GET", null, server),
    "track:web-demo-cylinderone",
  );
  expect(detail.tags.artist).toEqual(["Chris Zabriskie"]);
  expect(detail.credits[0]?.reference).toBe("artist:web-demo-chris");
});
