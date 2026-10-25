import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createBiographyLinker } from "./biography-catalog";
import { useLibrary } from "./context";
vi.mock("./context", () => ({ useLibrary: vi.fn() }));

it("retires retained track links when a source projection disappears or the biography changes source", () => {
  createRoot((dispose) => {
    const [reference, setReference] = createSignal("artist:owner");
    const [tracks, setTracks] = createSignal([
      {
        reference: "track:one",
        title: "Silver Wings",
        release: null,
        album_title: null,
        track_no: null,
      },
    ]);
    vi.mocked(useLibrary).mockReturnValue({
      artists: () => [],
      albums: () => [],
      publicSnapshot: (source: string) => (source === "server" ? { tracks: tracks() } : undefined),
    } as unknown as ReturnType<typeof useLibrary>);
    const link = createBiographyLinker(reference);
    expect(link()("Silver Wings")[0]?.target?.kind).toBe("tracks");
    setReference("artist:@phemios/local/owner");
    expect(link()("Silver Wings")).toEqual([{ text: "Silver Wings" }]);
    setReference("artist:owner");
    expect(link()("Silver Wings")[0]?.target?.kind).toBe("tracks");
    setTracks([]);
    expect(link()("Silver Wings")).toEqual([{ text: "Silver Wings" }]);
    dispose();
  });
});

it("reuses a supplied long-reader index and admits a subsequent switch to the resident catalogue", () => {
  createRoot((dispose) => {
    const supplied = (text: string) => [{ text }];
    const [override, setOverride] = createSignal<typeof supplied | undefined>(supplied);
    const read = vi.fn(() => undefined);
    vi.mocked(useLibrary).mockReturnValue({
      artists: () => [],
      albums: () => [],
      publicSnapshot: read,
    } as unknown as ReturnType<typeof useLibrary>);
    const link = createBiographyLinker(() => "artist:owner", override);
    expect(link()).toBe(supplied);
    expect(read).not.toHaveBeenCalled();
    setOverride(undefined);
    expect(link()("Retained prose")).toEqual([{ text: "Retained prose" }]);
    expect(read).toHaveBeenCalledWith("server");
    dispose();
  });
});

it("updates available year links after the resident album catalogue changes", () => {
  createRoot((dispose) => {
    const [albums, setAlbums] = createSignal([
      { reference: "release:first", title: "Fictional Record", artist: null, year: 1970, tags: [] },
    ]);
    vi.mocked(useLibrary).mockReturnValue({
      artists: () => [],
      albums,
      publicSnapshot: () => undefined,
    } as unknown as ReturnType<typeof useLibrary>);
    const link = createBiographyLinker(() => "artist:solo");
    expect(link()("En 1970.").find((part) => part.target)?.target).toEqual({
      kind: "year",
      year: 1970,
    });
    setAlbums([]);
    expect(link()("En 1970.")).toEqual([{ text: "En 1970." }]);
    dispose();
  });
});
