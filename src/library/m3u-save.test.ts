import { expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { saveLibraryM3U } from "./m3u-save";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
it("refuses an old server or changed session before writing library files", async () => {
  vi.mocked(requestAede).mockResolvedValue({ capabilities: [] });
  await expect(saveLibraryM3U("release:one", "Album", () => true)).rejects.toThrow(
    /redémarrez Aède/,
  );
  expect(requestAede).toHaveBeenCalledTimes(1);
  vi.mocked(requestAede)
    .mockClear()
    .mockResolvedValue({ capabilities: ["library_m3u_publication"] });
  expect(await saveLibraryM3U("release:one", "Album", () => false)).toBeUndefined();
  expect(requestAede).toHaveBeenCalledTimes(1);
});
it("requests explicit library publication and refuses a success with no published destinations", async () => {
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce({ capabilities: ["library_m3u_publication"] })
    .mockResolvedValueOnce({
      id: "playlist-one",
      name: "Album",
      filename: "playlist-one.m3u",
      content: "#EXTM3U\n",
      library_files: ["/music/Artist/Album/Album.m3u"],
    });
  expect((await saveLibraryM3U("release:one", "Album", () => true))?.library_files?.length).toBe(1);
  expect(requestAede).toHaveBeenLastCalledWith("/api/me/v1/m3u", {}, "POST", {
    release: "release:one",
    name: "Album",
    library: true,
  });
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["library_m3u_publication"] })
    .mockResolvedValueOnce({ id: "playlist-two", library_files: [] });
  await expect(saveLibraryM3U("release:one", "Album", () => true)).rejects.toThrow();
});
