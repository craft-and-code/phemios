import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPlayback } from "../library/playback";
import { idlePlayback } from "../library/playback-state";
import { createNetworkAudio } from "./controller";
import { prepareNetworkPlayback } from "./local-handoff";
import { playbackControl, playbackStart, playbackState, requestAede } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({
  playbackControl: vi.fn(),
  playbackStart: vi.fn(),
  playbackState: vi.fn(),
  playbackOutputs: vi.fn(),
  playbackAppend: vi.fn(),
  requestAede: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("refuses network admission while an idle-looking local queue is still starting", async () => {
  await createRoot(async (dispose) => {
    const album = {
      reference: "release:one",
      title: "Release",
      artist: null,
      year: null,
      compilation: false,
      tags: [],
    };
    const owner = {
      server: "https://music.example",
      account: { id: "fixture", username: "fixture", role: "admin" as const },
    };
    const player = createPlayback(
      () => true,
      () => ({ albums: [album], artists: [] }),
    );
    await player.appendSelection(
      async () => ({
        items: [
          {
            reference: "track:one",
            title: "First",
            release: album.reference,
            number: 1,
            album_total: 1,
          },
        ],
      }),
      "server",
    );
    vi.mocked(requestAede).mockImplementation(async (path) =>
      path === "/api/v1/status"
        ? { capabilities: ["network_audio_upnp"] }
        : path.endsWith("/discover")
          ? { items: [{ name: "Renderer", endpoint: "http://192.168.1.20/device.xml" }] }
          : { id: 7, status: "running" },
    );
    const network = createNetworkAudio({
      source: () => "server",
      session: () => owner,
      queue: player.queue,
      beforeStart: () => prepareNetworkPlayback(player, "Local transport is busy"),
    });
    await network.discover("192.168.1.10");
    let finish!: () => void;
    vi.mocked(playbackStart).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(playbackControl).mockResolvedValue(undefined);
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 1,
    });
    const starting = player.playQueueOccurrence(0);
    try {
      await vi.waitFor(() => expect(playbackStart).toHaveBeenCalledOnce());
      expect(player.busy()).toBe(true);
      expect(player.state().status).toBe("idle");
      await network.start("192.168.1.10", "http://192.168.1.20/device.xml");
      expect(requestAede).not.toHaveBeenCalledWith(
        "/api/admin/v1/network-audio/play",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(network.error()).toBe("Local transport is busy");
    } finally {
      finish();
      await starting;
      dispose();
    }
  });
});

it.each([false, true])(
  "waits for local Stop and respects logout=%s before network admission",
  async (logout) => {
    await createRoot(async (dispose) => {
      const album = {
        reference: "release:one",
        title: "Release",
        artist: null,
        year: null,
        compilation: false,
        tags: [],
      };
      const owner = {
        server: "https://music.example",
        account: { id: "fixture", username: "fixture", role: "admin" as const },
      };
      const [session, setSession] = createSignal<typeof owner | undefined>(owner);
      let status: "playing" | "idle" = "playing";
      vi.mocked(playbackState).mockImplementation(async () => ({
        ...idlePlayback,
        status,
        reference: status === "playing" ? "track:one" : "",
        total: 1,
      }));
      vi.mocked(playbackStart).mockResolvedValue(undefined);
      vi.mocked(playbackControl).mockResolvedValue(undefined);
      const player = createPlayback(
        () => true,
        () => ({ albums: [album], artists: [] }),
      );
      await player.start(
        [{ reference: "track:one", title: "First", duration_ms: 5000, analyses: [] }],
        album,
        "Artist",
      );
      vi.mocked(requestAede).mockImplementation(async (path) =>
        path === "/api/v1/status"
          ? { capabilities: ["network_audio_upnp"] }
          : path.endsWith("/discover")
            ? { items: [{ name: "Renderer", endpoint: "http://192.168.1.20/device.xml" }] }
            : { id: 7, status: "running" },
      );
      const network = createNetworkAudio({
        source: () => "server",
        session,
        queue: player.queue,
        beforeStart: () => prepareNetworkPlayback(player, "Stop was not confirmed"),
      });
      await network.discover("192.168.1.10");
      let finish!: () => void;
      vi.mocked(playbackControl).mockImplementation(async (command) => {
        if (command === "stop")
          await new Promise<void>((resolve) => {
            finish = () => {
              status = "idle";
              resolve();
            };
          });
      });
      const switching = network.start("192.168.1.10", "http://192.168.1.20/device.xml");
      try {
        await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
        expect(
          vi.mocked(requestAede).mock.calls.filter(([path]) => path.endsWith("/play")),
        ).toHaveLength(0);
        if (logout) setSession(undefined);
        finish();
        await switching;
        const submitted = vi
          .mocked(requestAede)
          .mock.calls.filter(([path]) => path.endsWith("/play"));
        expect(submitted).toHaveLength(logout ? 0 : 1);
        expect(player.state().status).toBe("idle");
        expect(network.active()).toBe(!logout);
      } finally {
        finish?.();
        await switching;
        dispose();
      }
    });
  },
);
