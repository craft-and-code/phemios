import { expect, it, vi } from "vitest";
import { mountLibrary } from "./context-test-fixtures";
import { loginAede, startLocal, syncAede } from "../platform/desktop";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return mockLibraryDesktop();
});
const snapshot = (server: string, title: string, scannedAt = 1, source = "server") => ({
  server,
  accountId: "fixture-admin",
  scannedAt,
  artists: [],
  albums: [
    {
      reference: `release:@phemios/${source}/fixture`,
      artist: null,
      title,
      year: 2001,
      compilation: false,
      tags: [],
      track_count: 1,
    },
  ],
});
it.each(
  [true, false].flatMap((different) => [true, false].map((pending) => ({ different, pending }))),
)(
  "scopes retained catalogue to its server while sync is pending=$pending, changed authority=$different",
  async ({ different, pending }) => {
    const library = mountLibrary();
    const previous = "https://fixture.example";
    vi.mocked(syncAede).mockResolvedValueOnce(snapshot(previous, "Previous catalogue"));
    await library.connect(previous, "fixture-admin", "fixture");
    expect(library.albums().map((album) => album.title)).toEqual(["Previous catalogue"]);
    const next = different ? "https://replacement.example" : previous;
    const username = different ? "fixture-admin" : "other-admin";
    vi.mocked(loginAede).mockResolvedValueOnce({
      server: next,
      nativeSession: "replacement-session",
      account: { id: username, username, role: "admin" },
    });
    let finish = () => {};
    if (pending)
      vi.mocked(syncAede).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            finish = () => reject(new Error("Replacement catalogue unavailable"));
          }),
      );
    else vi.mocked(syncAede).mockRejectedValueOnce(new Error("Replacement catalogue unavailable"));
    const connecting = library.connect(next, username, "fixture");
    try {
      await vi.advanceTimersByTimeAsync(0);
      if (!pending) await connecting;
      expect(library.serverSession()?.server).toBe(next);
      expect(syncAede).toHaveBeenCalledTimes(2);
      expect(library.publicSnapshot("server")?.server).toBe(different ? undefined : previous);
      expect((library.snapshot()?.albums ?? []).map((album) => album.title)).toEqual(
        different ? [] : ["Previous catalogue"],
      );
      expect(library.trackSources()[0]?.scannedAt).toBe(different ? undefined : 1);
    } finally {
      finish();
      await connecting;
    }
    vi.mocked(syncAede).mockResolvedValueOnce({
      ...snapshot(next, "Current catalogue", 2),
      accountId: username,
    });
    await library.sync("server");
    expect(library.albums().map((album) => album.title)).toEqual(["Current catalogue"]);
    expect(library.publicSnapshot("server")?.server).toBe(next);
    expect(library.trackSources()[0]?.scannedAt).toBe(2);
  },
);
it("retains public offline browsing and managed-local catalogue across loopback port changes", async () => {
  const library = mountLibrary();
  const previous = "https://127.0.0.1:41001";
  const next = "https://127.0.0.1:41002";
  const owner = (server: string) => ({
    server,
    nativeSession: server,
    account: { id: "fixture-admin", username: "fixture-admin", role: "admin" },
  });
  vi.mocked(startLocal).mockResolvedValueOnce(owner(previous));
  vi.mocked(syncAede).mockResolvedValueOnce(snapshot(previous, "Managed local", 1, "local"));
  await library.enableLocal();
  expect(library.albums().map((album) => album.title)).toEqual(["Managed local"]);
  await library.disableLocal();
  expect(library.publicSnapshot("local")?.server).toBe(previous);
  vi.mocked(startLocal).mockResolvedValueOnce(owner(next));
  vi.mocked(syncAede).mockRejectedValueOnce(new Error("Local synchronization unavailable"));
  await library.enableLocal();
  expect(library.localSession()?.server).toBe(next);
  expect(library.publicSnapshot("local")?.server).toBe(previous);
  expect(library.albums().map((album) => album.title)).toEqual(["Managed local"]);
});
