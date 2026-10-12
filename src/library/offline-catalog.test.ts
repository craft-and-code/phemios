import { expect, it } from "vitest";
import { cachedLabelPage, cachedTrackPage, publicCatalogSources } from "./offline-catalog";
import type { Snapshot } from "./server";
const snapshot = (): Snapshot => ({
  artists: [],
  albums: [],
  server: "https://catalog.example",
  accountId: "fictional",
  scannedAt: 42,
  tracks: Array.from({ length: 51 }, (_, index) => ({
    reference: `track:@phemios/server/${index}`,
    title: `Écho ${index}`,
    release: null,
    album_title: null,
    disc_no: null,
    track_no: null,
    album_position: null,
    duration_ms: 1000,
    analysis_available: false,
    spectrum_available: false,
    analyses: [],
  })),
  labels: [
    {
      reference: "label:@phemios/server/zulu",
      name: "Zulu",
      releaseCount: 2,
      releases: ["release:@phemios/server/1", "release:@phemios/server/2"],
    },
    {
      reference: "label:@phemios/server/alpha",
      name: "Álpha",
      releaseCount: 1,
      releases: ["release:@phemios/server/3"],
    },
  ],
});
it("keeps exact cached sources after logout without treating them as authenticated", () => {
  const cached = snapshot();
  const read = (source: string) => (source === "server" ? cached : undefined);
  expect(
    publicCatalogSources(read, [{ source: "server", identity: "live-account", scannedAt: 42 }])[0]
      ?.online,
  ).toBe(true);
  const offline = publicCatalogSources(read, []);
  expect(offline).toHaveLength(1);
  expect(offline[0]?.online).toBe(false);
  expect(offline[0]?.snapshot).toBe(cached);
  expect(publicCatalogSources(() => undefined, [])).toEqual([]);
});
it("paginates exact cached tracks, retaining albumless entries and scoped accent-insensitive search", () => {
  const cached = snapshot();
  expect(cachedTrackPage(cached, "", 0).items).toHaveLength(50);
  expect(cachedTrackPage(cached, "", 50).items[0]?.reference).toBe("track:@phemios/server/50");
  expect(cachedTrackPage(cached, "éCho 50", 0).total).toBe(1);
  expect(cachedTrackPage(cached, "unrecorded credit", 0).total).toBe(0);
  expect(cached.tracks).toHaveLength(51);
});
it("sorts labels by name or album count with exact retained associations and no mutation", () => {
  const cached = snapshot();
  expect(cachedLabelPage(cached, "", 0, "name", false).items[0]?.name).toBe("Álpha");
  expect(cachedLabelPage(cached, "", 0, "name", true).items[0]?.name).toBe("Zulu");
  expect(cachedLabelPage(cached, "", 0, "albums", false).items[0]?.name).toBe("Álpha");
  expect(cachedLabelPage(cached, "", 0, "albums", true).items[0]?.name).toBe("Zulu");
  expect(cachedLabelPage(cached, "alpha", 0, "name", false).items[0]?.releases).toEqual([
    "release:@phemios/server/3",
  ]);
  expect(cached.labels?.[0]?.name).toBe("Zulu");
});
it("distinguishes a complete empty projection from old caches requiring explicit synchronization", () => {
  const old = {
    artists: [],
    albums: [],
    server: "https://catalog.example",
    accountId: "fictional",
    scannedAt: 42,
  };
  expect(() => cachedTrackPage(old, "", 0)).toThrow(/Synchronisez/);
  expect(() => cachedLabelPage(old, "", 0, "name", false)).toThrow(/Synchronisez/);
  expect(cachedTrackPage({ ...old, tracks: [] }, "", 0).total).toBe(0);
  expect(cachedLabelPage({ ...old, labels: [] }, "", 0, "name", false).total).toBe(0);
});

it("does not use an earlier public cache as fallback for a replacing live authority or owner", () => {
  const cached = snapshot();
  const read = (source: string) => (source === "server" ? cached : undefined);
  const matching = publicCatalogSources(read, [
    { source: "server", identity: `${cached.server}:${cached.accountId}`, scannedAt: 42 },
  ]);
  expect(matching[0]?.snapshot).toBe(cached);
  for (const identity of [
    "https://other.example:fictional",
    `${cached.server}:replacement-owner`,
  ]) {
    const source = publicCatalogSources(read, [{ source: "server", identity, scannedAt: 42 }])[0];
    expect(source?.online).toBe(true);
    expect(source?.snapshot).toBeUndefined();
    expect(source?.scannedAt).toBeUndefined();
  }
});
