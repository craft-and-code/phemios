import { expect, it, vi } from "vitest";
import { mountLibrary } from "./context-test-fixtures";
import { loginAede, requestAede, syncAede } from "../platform/desktop";
import { parentalStatus } from "./parental-test-fixtures";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return mockLibraryDesktop();
});
const settle = async () => {
  for (let i = 0; i < 48; i++) await Promise.resolve();
};
it.each(["resident", "pending"] as const)(
  "keeps local artwork %s when a remote policy changes and its catalogue reload fails",
  async (mode) => {
    let policy = { ...parentalStatus(), owner: "fixture-child" };
    vi.mocked(loginAede).mockResolvedValueOnce({
      nativeSession: "child-session",
      server: "https://fixture.example",
      account: {
        id: "fixture-child",
        username: "fixture-child",
        role: "user",
        parental_enabled: false,
      },
    });
    vi.mocked(requestAede).mockImplementation(
      async (path, _query, _method, _body, _source, captured) => {
        if (path === "/api/auth/v1/session") return { ...captured?.account, enabled: true };
        if (path === "/api/me/v1/parental") return policy;
        return { items: [], total: 0, offset: 0, limit: 200, scanned_at: 1 };
      },
    );
    vi.mocked(syncAede).mockImplementation(async (source = "server") => ({
      server: "https://fixture.example",
      accountId: source === "local" ? "fixture-admin" : "fixture-child",
      scannedAt: 1,
      artists: [],
      albums: (source === "local" ? ["first", "second"] : ["remote"]).map((id) => ({
        reference: `release:@phemios/${source}/${id}`,
        title: id,
        artist: null,
        year: 2000,
        compilation: false,
        tags: [],
        cover: true,
      })),
    }));
    let finish!: (bytes: ArrayBuffer) => void;
    const held = new Promise<ArrayBuffer>((resolve) => {
      finish = resolve;
    });
    const first = "release:@phemios/local/first";
    const second = "release:@phemios/local/second";
    const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
    const art = vi.spyOn(await import("../platform/desktop"), "artworkAede");
    art.mockImplementation((ref) =>
      mode === "pending" && ref === first ? held : Promise.resolve(bytes),
    );
    vi.stubGlobal(
      "Image",
      class {
        src = "";
      },
    );
    const library = mountLibrary();
    await library.connect("https://fixture.example", "fixture-child", "fixture");
    await library.enableLocal();
    await settle();
    const before = library.image(first, "cover");
    const remoteReads = art.mock.calls.filter(([ref]) => ref.includes("@phemios/server/")).length;
    if (mode === "resident") expect(before).toBeTruthy();
    else expect(art.mock.calls.filter(([ref]) => ref === first)).toHaveLength(1);
    policy = {
      ...policy,
      revision: 1,
      policy: { ...policy.policy, enabled: true },
    };
    vi.mocked(syncAede).mockRejectedValueOnce(new Error("Server catalogue unavailable"));
    await library.parental.refresh("server");
    await settle();
    expect(library.publicSnapshot("server")).toBeUndefined();
    expect(library.publicSnapshot("local")?.albums).toHaveLength(2);
    expect(library.error()).toBe("Server catalogue unavailable");
    if (mode === "resident") expect(library.image(first, "cover")).toBe(before);
    else {
      finish(bytes);
      await settle();
      expect(library.image(first, "cover")).toBeTruthy();
    }
    expect(library.image(second, "cover")).toBeTruthy();
    expect(art.mock.calls.filter(([ref]) => ref === first)).toHaveLength(1);
    expect(art.mock.calls.filter(([ref]) => ref === second)).toHaveLength(1);
    expect(art.mock.calls.filter(([ref]) => ref.includes("@phemios/server/"))).toHaveLength(
      remoteReads,
    );
  },
);
