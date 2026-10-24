import { expect, it, vi } from "vitest";
import { mountLibrary, disposeLibrary } from "./context-test-fixtures";
import { clearServerCache, syncAede } from "../platform/desktop";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return { ...(await mockLibraryDesktop()), clearServerCache: vi.fn(async () => {}) };
});
async function populated() {
  const library = mountLibrary();
  vi.mocked(syncAede).mockResolvedValue({
    server: "https://fixture.example",
    accountId: "fixture-admin",
    scannedAt: 1,
    artists: [],
    albums: [
      {
        reference: "release:@phemios/server/fixture",
        title: "Cached album",
        artist: null,
        year: null,
        compilation: false,
        tags: [],
      },
    ],
  });
  await library.connect("https://fixture.example", "fixture-admin", "fixture");
  return library;
}
it("hides only disconnected server data, retains it and makes it visible again", async () => {
  const library = await populated();
  await library.disconnect();
  expect(library.albums()).toHaveLength(1);
  library.setServerCacheHidden(true);
  expect(library.publicSnapshot("server")).toBeUndefined();
  expect(library.serverCache()).toBeDefined();
  expect(clearServerCache).not.toHaveBeenCalled();
  library.setServerCacheHidden(false);
  expect(library.albums()).toHaveLength(1);
});
it("refuses clearing an active server, then clears only after native success", async () => {
  const library = await populated();
  await expect(library.clearServerCache()).rejects.toThrow();
  expect(clearServerCache).not.toHaveBeenCalled();
  await library.disconnect();
  vi.mocked(clearServerCache).mockRejectedValueOnce(new Error("Disk refused"));
  await expect(library.clearServerCache()).rejects.toThrow("Disk refused");
  expect(library.serverCache()).toBeDefined();
  await library.clearServerCache();
  expect(library.serverCache()).toBeUndefined();
  expect(library.publicSnapshot("server")).toBeUndefined();
});

it("persists hiding, preserves the choice on save failure and shows a live server despite hiding", async () => {
  const library = await populated();
  await library.disconnect();
  library.setServerCacheHidden(true);
  const stored = localStorage.getItem("phemios.server-cache-hidden.v1");
  const save = vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
    throw new Error("Storage full");
  });
  expect(() => library.setServerCacheHidden(false)).toThrow("Storage full");
  expect(library.serverCacheHidden()).toBe(true);
  expect(localStorage.getItem("phemios.server-cache-hidden.v1")).toBe(stored);
  save.mockRestore();
  disposeLibrary();
  const replacement = await populated();
  expect(replacement.serverCacheHidden()).toBe(true);
  expect(replacement.publicSnapshot("server")).toBeDefined();
});
it("leaves the local catalogue visible when the disconnected server cache is hidden or cleared", async () => {
  const library = await populated();
  vi.mocked(syncAede).mockResolvedValueOnce({
    server: "https://fixture.example",
    accountId: "fixture-admin",
    scannedAt: 2,
    artists: [],
    albums: [
      {
        reference: "release:@phemios/local/fixture",
        title: "Local album",
        artist: null,
        year: 2000,
        compilation: false,
        tags: [],
      },
    ],
  });
  await library.enableLocal();
  await library.disconnect();
  library.setServerCacheHidden(true);
  expect(library.albums().map((row) => row.title)).toEqual(["Local album"]);
  await library.clearServerCache();
  expect(library.albums().map((row) => row.title)).toEqual(["Local album"]);
  expect(library.localSession()).toBeDefined();
});

it("does not revoke local artwork when clearing a disconnected server cache", async () => {
  vi.spyOn(await import("../platform/desktop"), "artworkAede").mockResolvedValue(
    new Uint8Array([137, 80, 78, 71]).buffer,
  );
  vi.stubGlobal(
    "Image",
    class {
      src = "";
    },
  );
  const library = await populated();
  vi.mocked(syncAede).mockResolvedValueOnce({
    server: "https://fixture.example",
    accountId: "fixture-admin",
    scannedAt: 2,
    artists: [],
    albums: [
      {
        reference: "release:@phemios/local/fixture",
        title: "Local album",
        artist: null,
        year: 2000,
        compilation: false,
        tags: [],
      },
    ],
  });
  await library.enableLocal();
  await library.disconnect();
  const reference = "release:@phemios/local/fixture";
  await library.warmImage(reference, "cover");
  const before = library.image(reference, "cover");
  expect(before).toBeTruthy();
  await library.clearServerCache();
  expect(library.image(reference, "cover")).toBe(before);
});

it("does not continue the old remote artwork queue after clearing its catalogue", async () => {
  const desktop = await import("../platform/desktop");
  let finish!: (bytes: ArrayBuffer) => void;
  const art = vi
    .spyOn(desktop, "artworkAede")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockRejectedValue(new Error("Cache removed"));
  const library = mountLibrary();
  vi.mocked(syncAede).mockResolvedValueOnce({
    server: "https://fixture.example",
    accountId: "fixture-admin",
    scannedAt: 1,
    artists: [],
    albums: ["first", "second"].map((id) => ({
      reference: `release:@phemios/server/${id}`,
      title: id,
      artist: null,
      year: 2000,
      compilation: false,
      tags: [],
      cover: true,
    })),
  });
  await library.connect("https://fixture.example", "fixture-admin", "fixture");
  expect(art).toHaveBeenCalledTimes(1);
  await library.disconnect();
  await library.clearServerCache();
  finish(new Uint8Array([137]).buffer);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(art).toHaveBeenCalledTimes(1);
  expect(library.mediaErrors()).toBe(0);
  expect(library.mediaProgress()).toEqual([0, 0]);
});

it("retires a pending clear acknowledgement when its provider is disposed", async () => {
  const library = await populated();
  await library.disconnect();
  const before = library.serverCache();
  let finish!: () => void;
  vi.mocked(clearServerCache).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = library.clearServerCache();
  const current = vi.mocked(clearServerCache).mock.calls.at(-1)?.[0];
  expect(current?.()).toBe(true);
  disposeLibrary();
  expect(current?.()).toBe(false);
  finish();
  await pending;
  expect(library.serverCache()).toBe(before);
});

it("preserves in-flight local artwork and continues only local warming after remote removal", async () => {
  const desktop = await import("../platform/desktop");
  let finish!: (bytes: ArrayBuffer) => void;
  const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
  const art = vi
    .spyOn(desktop, "artworkAede")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(bytes);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
    },
  );
  const library = await populated();
  vi.mocked(syncAede).mockResolvedValueOnce({
    server: "https://fixture.example",
    accountId: "fixture-admin",
    scannedAt: 2,
    artists: [],
    albums: ["first", "second"].map((id) => ({
      reference: `release:@phemios/local/${id}`,
      title: id,
      artist: null,
      year: 2000,
      compilation: false,
      tags: [],
      cover: true,
    })),
  });
  await library.enableLocal();
  expect(art).toHaveBeenCalledTimes(1);
  await library.disconnect();
  await library.clearServerCache();
  finish(bytes);
  for (let i = 0; i < 30; i++) await Promise.resolve();
  expect(art).toHaveBeenCalledTimes(2);
  expect(art.mock.calls.every(([ref]) => ref.includes("@phemios/local/"))).toBe(true);
  expect(library.image("release:@phemios/local/first", "cover")).toBeTruthy();
  expect(library.image("release:@phemios/local/second", "cover")).toBeTruthy();
  expect(library.mediaProgress()).toEqual([2, 2]);
  expect(library.mediaErrors()).toBe(0);
});
