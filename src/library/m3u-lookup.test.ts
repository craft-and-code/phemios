import { expect, it, vi } from "vitest";
import { requestAede } from "../platform/desktop";
import { lookupAlbumM3U } from "./m3u-lookup";
vi.mock("../platform/desktop", () => ({ requestAede: vi.fn() }));
const id = "m3u-file-" + "a".repeat(64);
const page = (items: unknown[] = [], reference = "release:edition") => ({
  reference,
  items,
  total: items.length,
  offset: 0,
  limit: 1,
  scanned_at: 1,
  unavailable_roots: 0,
  unreadable_directories: 0,
});
it("retains only existing file metadata and uses its exact local release selector", async () => {
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce({ capabilities: ["album_m3u_lookup"] })
    .mockResolvedValueOnce(
      page(
        [
          {
            id,
            name: "Album",
            path: "/music/Artist/Album/Album.m3u",
            filename: "Album.m3u",
            track_count: null,
          },
        ],
        "release:@phemios/local/edition",
      ),
    );
  const file = await lookupAlbumM3U("release:@phemios/local/edition", () => true);
  expect(file).toMatchObject({ id, source: "local", filename: "Album.m3u" });
  expect(file).not.toHaveProperty("content");
  expect(requestAede).toHaveBeenLastCalledWith(
    "/api/me/v1/m3u-files",
    { ref: "release:@phemios/local/edition", limit: "1" },
    "GET",
    null,
    "local",
  );
});
it("distinguishes a confirmed absent file from unavailable or unsupported lookup", async () => {
  vi.mocked(requestAede)
    .mockReset()
    .mockResolvedValueOnce({ capabilities: ["album_m3u_lookup"] })
    .mockResolvedValueOnce(page());
  expect(await lookupAlbumM3U("release:edition", () => true)).toBeNull();
  vi.mocked(requestAede).mockResolvedValueOnce({ capabilities: [] });
  await expect(lookupAlbumM3U("release:edition", () => true)).rejects.toThrow(/redémarrez/);
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["album_m3u_lookup"] })
    .mockResolvedValueOnce({ ...page(), unavailable_roots: 1 });
  await expect(lookupAlbumM3U("release:edition", () => true)).rejects.toThrow();
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["album_m3u_lookup"] })
    .mockResolvedValueOnce({ ...page(), total: 1 });
  await expect(lookupAlbumM3U("release:edition", () => true)).rejects.toThrow();
  vi.mocked(requestAede)
    .mockResolvedValueOnce({ capabilities: ["album_m3u_lookup"] })
    .mockResolvedValueOnce(page([], "release:another"));
  await expect(lookupAlbumM3U("release:edition", () => true)).rejects.toThrow();
});
it("does not admit metadata reads or acknowledgements after owner replacement", async () => {
  const request = vi.mocked(requestAede).mockReset();
  expect(await lookupAlbumM3U("release:edition", () => false)).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
  let current = true;
  request.mockImplementationOnce(async () => {
    current = false;
    return { capabilities: ["album_m3u_lookup"] };
  });
  expect(await lookupAlbumM3U("release:edition", () => current)).toBeUndefined();
  expect(request).toHaveBeenCalledTimes(1);
});
