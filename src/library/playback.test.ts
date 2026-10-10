import { createRoot } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPlayback } from "./playback";
import { idlePlayback } from "./playback-state";
import {
  playbackState,
  playbackStart,
  playbackControl,
  playbackOutputs,
  requestAede,
} from "../platform/desktop";
vi.mock("../platform/desktop", () => ({
  playbackState: vi.fn(),
  playbackStart: vi.fn(),
  playbackControl: vi.fn(),
  playbackOutputs: vi.fn(),
  requestAede: vi.fn(),
}));
const album = {
  reference: "release:one",
  title: "Release",
  artist: null,
  year: null,
  compilation: false,
  tags: [],
};
const tracks = [
  { reference: "track:one", title: "First", duration_ms: 5000, analyses: [] },
  { reference: "track:two", title: "Second", duration_ms: 5000, analyses: [] },
];
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});
it("does not poll or play offline and sends the complete queue with the selected start index", async () => {
  await createRoot(async (dispose) => {
    let connected = false;
    const player = createPlayback(() => connected);
    await vi.advanceTimersByTimeAsync(10000);
    await player.start(tracks, album, "Artist");
    expect(playbackStart).not.toHaveBeenCalled();
    expect(playbackState).not.toHaveBeenCalled();
    connected = true;
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:two",
      total: 2,
      index: 1,
      position_ms: 1234,
    });
    await player.start(tracks, album, "Artist", 1);
    expect(playbackStart).toHaveBeenCalledWith(
      ["track:one", "track:two"],
      "",
      1,
      "without-effects",
    );
    expect(player.current()?.title).toBe("Second");
    expect(player.state().position_ms).toBe(1234);
    await player.action("pause");
    expect(playbackControl).toHaveBeenCalledWith("pause", null);
    dispose();
  });
});
it("rejects a late native result after logout and leaves no playback poll", async () => {
  await createRoot(async (dispose) => {
    let complete!: (v: unknown) => void;
    vi.mocked(playbackState).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const player = createPlayback(() => true);
    const pending = player.start(tracks, album, "Artist");
    await vi.waitFor(() => expect(playbackState).toHaveBeenCalledOnce());
    player.reset();
    complete({ ...idlePlayback, status: "playing", reference: "track:one", total: 2 });
    await pending;
    await vi.advanceTimersByTimeAsync(10000);
    expect(player.state().status).toBe("idle");
    expect(player.current()).toBeUndefined();
    expect(playbackState).toHaveBeenCalledOnce();
    dispose();
  });
});
it("keeps the final volume of a fast drag without replaying every intermediate value", async () => {
  await createRoot(async (dispose) => {
    let release!: () => void;
    vi.mocked(playbackControl)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const player = createPlayback(() => true);
    const first = player.volume(0.1);
    await player.volume(0.2);
    await player.volume(0.3);
    release();
    await first;
    expect(playbackControl).toHaveBeenCalledTimes(2);
    expect(playbackControl).toHaveBeenLastCalledWith("volume", 0.3);
    expect(player.state().volume).toBe(0.3);
    dispose();
  });
});
it("toggles mute while retaining the latest audible volume", async () => {
  await createRoot(async (dispose) => {
    const p = createPlayback(() => true);
    await p.volume(0.7);
    await p.toggleMute();
    expect(p.state().volume).toBe(0);
    await p.toggleMute();
    expect(p.state().volume).toBe(0.7);
    await p.volume(0.2);
    await p.toggleMute();
    await p.toggleMute();
    expect(p.state().volume).toBe(0.2);
    dispose();
  });
});
it("retains countdown on the device for the identified account and publishes its account preference", () => {
  const held = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => held.set(k, v),
  });
  createRoot((dispose) => {
    const p = createPlayback(() => true);
    p.identify("server:alice");
    p.toggleTime();
    expect(p.remaining()).toBe(true);
    p.reset();
    expect(p.remaining()).toBe(false);
    p.identify("server:bob");
    expect(p.remaining()).toBe(false);
    p.identify("server:alice");
    expect(p.remaining()).toBe(true);
    dispose();
  });
  vi.unstubAllGlobals();
});
it("starts server-ordered discography metadata and refuses an edition absent from cache", async () => {
  await createRoot(async (dispose) => {
    const p = createPlayback(
      () => true,
      () => ({ albums: [album], artists: [] }),
    );
    p.setTarget("artist:one");
    vi.mocked(requestAede).mockResolvedValue({
      items: [
        {
          reference: "track:one",
          title: "First",
          release: album.reference,
          number: 1,
          album_total: 2,
        },
        {
          reference: "track:two",
          title: "Second",
          release: album.reference,
          number: 2,
          album_total: 2,
        },
      ],
    });
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
    });
    await p.startReference();
    expect(requestAede).toHaveBeenCalledWith("/api/v1/presentation/playback", {
      ref: "artist:one",
    });
    expect(p.current()?.albumTotal).toBe(2);
    expect(playbackStart).toHaveBeenCalledWith(
      ["track:one", "track:two"],
      "",
      0,
      "without-effects",
    );
    vi.mocked(requestAede).mockResolvedValue({
      items: [
        {
          reference: "track:other",
          title: "Changed",
          release: "release:missing",
          number: 1,
          album_total: 1,
        },
      ],
    });
    await p.startReference();
    expect(p.error()).toMatch(/resynchronisez/);
    expect(playbackStart).toHaveBeenCalledOnce();
    dispose();
  });
});
it("stops an external source only when starting music, never on transport stop", async () => {
  await createRoot(async (dispose) => {
    const stopExternal = vi.fn();
    vi.mocked(playbackState).mockResolvedValue(idlePlayback);
    const player = createPlayback(() => true, undefined, stopExternal);
    await player.action("stop");
    expect(stopExternal).not.toHaveBeenCalled();
    await player.start(tracks, album, "Artist");
    expect(stopExternal).toHaveBeenCalledOnce();
    dispose();
  });
});

it("resumes the displayed paused album at its current track without restarting its queue", async () => {
  await createRoot(async (dispose) => {
    const current = {
      ...idlePlayback,
      reference: "track:two",
      total: 2,
      index: 1,
      position_ms: 2345,
    };
    vi.mocked(playbackState)
      .mockResolvedValueOnce({ ...current, status: "playing" })
      .mockResolvedValueOnce({ ...current, status: "paused" })
      .mockResolvedValue({ ...current, status: "playing" });
    const player = createPlayback(
      () => true,
      () => ({ albums: [album], artists: [] }),
    );
    await player.start(tracks, album, "Artist", 1);
    await player.action("pause");
    await player.startReference(album.reference);
    expect(playbackControl).toHaveBeenLastCalledWith("resume", null);
    expect(playbackStart).toHaveBeenCalledOnce();
    expect(requestAede).not.toHaveBeenCalled();
    expect(player.state().position_ms).toBe(2345);
    dispose();
  });
});

it("shows output refresh for at least a second and admits only one discovery, without polling offline", async () => {
  await createRoot(async (dispose) => {
    let ready = false;
    const player = createPlayback(() => ready);
    await player.discover();
    expect(playbackOutputs).not.toHaveBeenCalled();
    ready = true;
    vi.mocked(playbackOutputs).mockResolvedValue([{ id: "one", name: "Output", default: true }]);
    const pending = player.discover();
    expect(player.discovering()).toBe(true);
    await player.discover();
    expect(playbackOutputs).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(player.discovering()).toBe(true);
    expect(player.outputs()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(player.discovering()).toBe(false);
    dispose();
  });
});
it("ends refresh visibly on failure and discards an old session's late outputs", async () => {
  await createRoot(async (dispose) => {
    const player = createPlayback(() => true);
    vi.mocked(playbackOutputs).mockRejectedValueOnce(Error("Host unavailable"));
    const failed = player.discover();
    await vi.advanceTimersByTimeAsync(1000);
    await failed;
    expect(player.error()).toBe("Host unavailable");
    expect(player.discovering()).toBe(false);
    let complete!: (value: unknown) => void;
    vi.mocked(playbackOutputs).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const late = player.discover();
    player.reset();
    expect(player.discovering()).toBe(false);
    complete([{ id: "old", name: "Old", default: false }]);
    await vi.advanceTimersByTimeAsync(1000);
    await late;
    expect(player.outputs()).toEqual([]);
    expect(player.error()).toBe("");
    expect(vi.getTimerCount()).toBe(0);
    dispose();
  });
});
it("retains queue row identities across clock polls and updates them only when occurrence order changes", async () => {
  await createRoot(async (dispose) => {
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      index: 0,
      queue: [0, 1],
      position_ms: 100,
    });
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Artist");
    const rows = player.queue();
    await vi.advanceTimersByTimeAsync(120);
    expect(player.queue()).toBe(rows);
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      index: 0,
      queue: [1, 0],
      position_ms: 400,
    });
    await vi.advanceTimersByTimeAsync(120);
    expect(player.queue().map((row) => row.index)).toEqual([1, 0]);
    dispose();
  });
});

it("stops playback when moving to HQPlayer and sends the engine mute toggle", async () => {
  await createRoot(async (dispose) => {
    vi.mocked(playbackControl).mockResolvedValue(null);
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
    });
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Fixture");
    vi.mocked(playbackState).mockResolvedValue({ ...idlePlayback });
    await player.chooseOutput("@hqplayer");
    expect(playbackControl).toHaveBeenCalledWith("stop", "@hqplayer");
    expect(player.device()).toBe("@hqplayer");
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      device: "@hqplayer",
    });
    await player.start(tracks, album, "Fixture");
    await player.toggleMute();
    expect(playbackControl).toHaveBeenCalledWith("mute", null);
    dispose();
  });
});

it("does not start audio when logout occurs during preference configuration", async () => {
  await createRoot(async (dispose) => {
    let release!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const player = createPlayback(() => true);
    const pending = player.start(tracks, album, "Artist");
    await Promise.resolve();
    player.reset();
    release();
    await pending;
    expect(playbackStart).not.toHaveBeenCalled();
    expect(playbackState).not.toHaveBeenCalled();
    dispose();
  });
});

it("changes crossfade duration without changing the current DSP policy or restarting playback", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  await createRoot(async (dispose) => {
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
    });
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Artist");
    vi.mocked(playbackControl).mockClear();
    await player.chooseCrossfade(3000);
    expect(player.policy()).toBe("without-effects");
    expect(playbackControl).toHaveBeenCalledExactlyOnceWith("crossfade", 3000);
    expect(playbackStart).toHaveBeenCalledOnce();
    expect(player.crossfade()).toBe(3000);
    dispose();
  });
  vi.unstubAllGlobals();
});
