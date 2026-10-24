import { expect, it, vi } from "vitest";
import { mountLibrary } from "./context-test-fixtures";
import { requestAede, syncAede } from "../platform/desktop";
import type { SourceId } from "./sources";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return mockLibraryDesktop();
});
const settle = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
const snapshot = (source: SourceId) => ({
  server: "https://fixture.example",
  accountId: "fixture-admin",
  scannedAt: 1,
  artists: [],
  albums: [
    {
      reference: `release:@phemios/${source}/fixture`,
      title: `${source} album`,
      artist: null,
      year: 2000,
      compilation: false,
      tags: [],
      cover: true,
    },
  ],
});
it.each(["local", "server"] as const)(
  "preserves the other source's resident artwork when refreshing %s",
  async (source) => {
    const desktop = await import("../platform/desktop");
    const art = vi
      .spyOn(desktop, "artworkAede")
      .mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
      },
    );
    vi.mocked(syncAede).mockImplementation(async (owner = "server") => snapshot(owner));
    const library = mountLibrary();
    await library.connect("https://fixture.example", "fixture-admin", "fixture");
    await library.enableLocal();
    await settle();
    const retained = source === "local" ? "server" : "local";
    const reference = `release:@phemios/${retained}/fixture`;
    const before = library.image(reference, "cover");
    expect(before).toBeTruthy();
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    art.mockClear();
    await library.sync(source);
    await settle();
    expect(library.image(reference, "cover")).toBe(before);
    expect(revoke).not.toHaveBeenCalledWith(before);
    expect(art.mock.calls.map(([ref]) => ref)).toEqual([`release:@phemios/${source}/fixture`]);
    expect(library.albums()).toHaveLength(2);
    expect(library.mediaErrors()).toBe(0);
  },
);

it.each(["local", "server"] as const)(
  "keeps the other source's pending image read when refreshing %s",
  async (source) => {
    const retained = source === "local" ? "server" : "local";
    const reference = `release:@phemios/${retained}/fixture`;
    let finish!: (bytes: ArrayBuffer) => void;
    const held = new Promise<ArrayBuffer>((resolve) => {
      finish = resolve;
    });
    const desktop = await import("../platform/desktop");
    const art = vi
      .spyOn(desktop, "artworkAede")
      .mockImplementation((ref) =>
        ref === reference ? held : Promise.resolve(new Uint8Array([137]).buffer),
      );
    vi.stubGlobal(
      "Image",
      class {
        src = "";
      },
    );
    vi.mocked(syncAede).mockImplementation(async (owner = "server") => snapshot(owner));
    const library = mountLibrary();
    await library.connect("https://fixture.example", "fixture-admin", "fixture");
    await library.enableLocal();
    await library.sync(source);
    await settle();
    expect(art.mock.calls.filter(([ref]) => ref === reference)).toHaveLength(1);
    finish(new Uint8Array([137, 80, 78, 71]).buffer);
    await settle();
    expect(library.image(reference, "cover")).toBeTruthy();
    expect(library.mediaProgress()).toEqual([2, 2]);
    expect(library.mediaErrors()).toBe(0);
  },
);

it.each(["local", "server"] as const)(
  "continues the other artwork queue when %s logs out during annotation loading",
  async (source) => {
    const page = { items: [], total: 0, offset: 0, limit: 200, scanned_at: 1 };
    vi.mocked(requestAede).mockImplementation(async (path) =>
      path === "/api/v1/status" ? { capabilities: [] } : page,
    );
    const retained = source === "local" ? "server" : "local";
    const first = `release:@phemios/${retained}/fixture`;
    const second = `release:@phemios/${retained}/second`;
    const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
    let finishImage!: (bytes: ArrayBuffer) => void;
    const held = new Promise<ArrayBuffer>((resolve) => {
      finishImage = resolve;
    });
    const art = vi.spyOn(await import("../platform/desktop"), "artworkAede");
    art.mockImplementation((ref) => (ref === first ? held : Promise.resolve(bytes)));
    vi.stubGlobal(
      "Image",
      class {
        src = "";
      },
    );
    vi.mocked(syncAede).mockImplementation(async (owner = "server") => {
      const value = snapshot(owner);
      return {
        ...value,
        albums:
          owner === retained
            ? [...value.albums, { ...value.albums[0]!, reference: second, title: "Second" }]
            : [],
      };
    });
    const library = mountLibrary();
    await library.connect("https://fixture.example", "fixture-admin", "fixture");
    await library.enableLocal();
    await settle();
    expect(art.mock.calls.map(([ref]) => ref)).toEqual([first]);
    let finishAnnotations!: (value: typeof page) => void;
    vi.mocked(requestAede).mockImplementation(async (path, _query, _method, _body, owner) =>
      path === "/api/me/v1/annotations" && owner === source
        ? new Promise((resolve) => {
            finishAnnotations = resolve;
          })
        : page,
    );
    const pending = library.sync(source);
    try {
      await settle();
      expect(finishAnnotations).toBeTypeOf("function");
      if (source === "local") await library.disableLocal();
      else await library.disconnect();
      finishImage(bytes);
      await settle();
      expect(library.image(first, "cover")).toBeTruthy();
      expect(library.image(second, "cover")).toBeTruthy();
      expect(art.mock.calls.map(([ref]) => ref)).toEqual([first, second]);
      expect(library.mediaProgress()).toEqual([2, 2]);
    } finally {
      finishImage(bytes);
      finishAnnotations(page);
      await pending;
    }
  },
);
