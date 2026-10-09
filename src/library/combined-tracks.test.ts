import { expect, it, vi } from "vitest";
import { combinedTrackReader } from "./combined-tracks";
import { catalogOrigins, effectiveSource, type SourceId } from "./sources";
const page = (source: SourceId, total: number, offset: number, stamp = 10) => ({
  total,
  offset,
  limit: 50,
  scanned_at: stamp,
  items: Array.from({ length: Math.max(0, Math.min(50, total - offset)) }, (_, i) => ({
    reference: `track:@phemios/${source}/${offset + i}`,
    title: "Same name",
    release: null,
    album_title: null,
    duration_ms: null,
    disc_no: null,
    track_no: null,
    album_position: null,
    analysis_available: false,
    spectrum_available: false,
  })),
});
it("combines colliding catalogs across page boundaries without downloading all tracks", async () => {
  const read = vi.fn(async (source: SourceId, at: number) =>
    page(source, source === "local" ? 63 : 125, at),
  );
  const reader = combinedTrackReader(
    [
      { source: "local", identity: "one", scannedAt: 10 },
      { source: "server", identity: "two", scannedAt: 10 },
    ],
    read,
  );
  const result = await reader(50);
  expect(result.total).toBe(188);
  expect(result.items).toHaveLength(50);
  expect(result.items[12]?.reference).toBe("track:@phemios/local/62");
  expect(result.items[13]?.reference).toBe("track:@phemios/server/0");
  const next = await reader(100);
  expect(next.items[0]?.reference).toBe("track:@phemios/server/37");
  expect(next.items.at(-1)?.reference).toBe("track:@phemios/server/86");
  expect(read.mock.calls).toEqual([
    ["local", 0],
    ["server", 0],
    ["local", 50],
    ["server", 50],
  ]);
});
it("retains the available catalog with an explicit failed source and retries only that source", async () => {
  let unavailable = true;
  const read = vi.fn(async (source: SourceId, at: number) => {
    if (source === "server" && unavailable) throw new Error("Unavailable");
    return page(source, 2, at);
  });
  const reader = combinedTrackReader(
    [
      { source: "local", identity: "one" },
      { source: "server", identity: "two" },
    ],
    read,
  );
  const result = await reader(0);
  expect(result.items).toHaveLength(2);
  expect(result.unavailable).toEqual([{ source: "server", error: "Error: Unavailable" }]);
  unavailable = false;
  expect((await reader(0)).items).toHaveLength(4);
  expect(read).toHaveBeenCalledTimes(3);
});
it("rejects a changed per-source epoch rather than comparing local tracks with the server epoch", async () => {
  const read = vi.fn(async (source: SourceId, at: number) =>
    page(source, 100, at, source === "local" ? (at ? 12 : 11) : 30),
  );
  const reader = combinedTrackReader(
    [
      { source: "local", identity: "one", scannedAt: 11 },
      { source: "server", identity: "two", scannedAt: 30 },
    ],
    read,
  );
  expect((await reader(0)).unavailable).toEqual([]);
  await expect(reader(50)).rejects.toThrow("catalogue a changé");
});
it("hides redundant origins and automatically follows a sole active or retained catalog", () => {
  expect(catalogOrigins(["release:@phemios/local/a"])).toEqual(["local"]);
  expect(catalogOrigins(["release:@phemios/local/a", "release:@phemios/server/a"])).toEqual([
    "local",
    "server",
  ]);
  expect(effectiveSource("server", ["local"], ["local", "server"])).toBe("local");
  expect(effectiveSource("local", ["server"], ["local", "server"])).toBe("server");
  expect(effectiveSource("local", ["local", "server"], ["local", "server"])).toBe("local");
  expect(effectiveSource("server", [], ["local"])).toBe("local");
});
it("honours display sizes without changing the bounded fifty-row wire pages", async () => {
  const read = vi.fn(async (source: SourceId, at: number) =>
    page(source, source === "local" ? 63 : 125, at),
  );
  const reader = combinedTrackReader(
    [
      { source: "local", identity: "one" },
      { source: "server", identity: "two" },
    ],
    read,
  );
  expect((await reader(25, 25)).items).toHaveLength(25);
  const result = await reader(50, 100);
  expect(result.items).toHaveLength(100);
  expect(result.items[12]?.reference).toBe("track:@phemios/local/62");
  expect(result.items[13]?.reference).toBe("track:@phemios/server/0");
  expect(result.items.at(-1)?.reference).toBe("track:@phemios/server/86");
  await expect(reader(0, 10000)).rejects.toThrow();
});
