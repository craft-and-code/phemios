import { expect, it, vi } from "vitest";
import { mountLibrary } from "./context-test-fixtures";
import { requestAede, syncAede } from "../platform/desktop";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return mockLibraryDesktop();
});
const reference = "label:@phemios/server/fixture";
const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const snapshot = (logo: boolean | undefined) => ({
  server: "https://fixture.example",
  accountId: "fixture-admin",
  scannedAt: 1,
  artists: [],
  albums: [],
  labels: [
    {
      reference,
      name: "Fixture",
      release_count: 0,
      releases: [],
      ...(logo === undefined ? {} : { logo }),
    },
  ],
});
it.each([false, undefined])("does not request unknown or absent label logos (%s)", async (logo) => {
  const art = vi.spyOn(await import("../platform/desktop"), "artworkAede");
  vi.mocked(syncAede).mockResolvedValue(snapshot(logo));
  const library = mountLibrary();
  await library.connect("https://fixture.example", "fixture-admin", "fixture");
  await settle();
  expect(art).not.toHaveBeenCalled();
  expect(library.image(reference, "logo")).toBeUndefined();
  expect(library.mediaErrors()).toBe(0);
});
it("warms an advertised label logo once and reuses it without provider enrichment", async () => {
  const art = vi
    .spyOn(await import("../platform/desktop"), "artworkAede")
    .mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
    },
  );
  vi.mocked(syncAede).mockResolvedValue(snapshot(true));
  const library = mountLibrary();
  await library.connect("https://fixture.example", "fixture-admin", "fixture");
  await settle();
  expect(art).toHaveBeenCalledExactlyOnceWith(reference, "logo");
  const resident = library.image(reference, "logo");
  expect(resident).toBeTruthy();
  await library.warmImage(reference, "logo");
  expect(library.image(reference, "logo")).toBe(resident);
  expect(art).toHaveBeenCalledTimes(1);
  expect(library.mediaProgress()).toEqual([1, 1]);
  expect(
    vi
      .mocked(requestAede)
      .mock.calls.some(([path, , method]) => path.includes("/tasks") && method === "POST"),
  ).toBe(false);
});
it("keeps an unavailable logo as a fallback and retries only after a refreshed catalogue", async () => {
  const art = vi
    .spyOn(await import("../platform/desktop"), "artworkAede")
    .mockRejectedValueOnce(new Error("Image indisponible"));
  vi.mocked(syncAede).mockResolvedValue(snapshot(true));
  const library = mountLibrary();
  await library.connect("https://fixture.example", "fixture-admin", "fixture");
  await settle();
  expect(library.image(reference, "logo")).toBeUndefined();
  expect(library.imageError(reference, "logo")).toBe("Image indisponible");
  expect(art).toHaveBeenCalledTimes(1);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
    },
  );
  art.mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer);
  await library.sync("server");
  await settle();
  expect(library.image(reference, "logo")).toBeTruthy();
  expect(library.imageError(reference, "logo")).toBe("");
});
