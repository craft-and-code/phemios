import { activateInterfaceProfile, interfacePreferences } from "./account-preferences";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPlayback } from "./playback";
import { createQueueLyrics } from "./queue-lyrics-controller";
import { referenceSource } from "./sources";
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
    expect(player.queue()[0]).toBe(rows[1]);
    expect(player.queue()[1]).toBe(rows[0]);
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

it("allows offline preemptive mute and volume, then applies the retained value before starting audio", async () => {
  await createRoot(async (dispose) => {
    let ready = false;
    const player = createPlayback(() => ready);
    await player.volume(0.23);
    await player.toggleMute();
    expect(player.state().volume).toBe(0);
    expect(playbackControl).not.toHaveBeenCalled();
    player.reset();
    expect(player.state().volume).toBe(0);
    ready = true;
    vi.mocked(playbackState).mockResolvedValue({ ...idlePlayback, volume: 0 });
    await player.start(tracks, album, "Artist");
    expect(playbackControl).toHaveBeenCalledWith("volume", 0);
    expect(vi.mocked(playbackControl).mock.invocationCallOrder.at(-1)).toBeLessThan(
      vi.mocked(playbackStart).mock.invocationCallOrder[0]!,
    );
    await player.toggleMute();
    expect(player.state().volume).toBe(0.23);
    dispose();
  });
});

it("keeps playback controls responsive while a crossfade write is pending", async () => {
  await createRoot(async (dispose) => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      index: 0,
      position_ms: 1234,
    });
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Artist");
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementation(async (command) => {
      if (command === "crossfade")
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
    });
    const write = player.chooseCrossfade(3000);
    try {
      expect(player.crossfade()).toBe(3000);
      expect(player.busy()).toBe(false);
      expect(player.state().status).toBe("playing");
      expect(player.state().position_ms).toBe(1234);
    } finally {
      finish();
      await write;
      dispose();
      vi.unstubAllGlobals();
    }
  });
});

it("keeps account audio restoration active across transport resets until disposal", () => {
  const values = new Map<string, string>();
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, raw: string) => values.set(key, raw),
  });
  try {
    createRoot((dispose) => {
      const player = createPlayback(() => true);
      player.reset();
      interfacePreferences.setItem(
        "phemios.audio.v1",
        JSON.stringify({ crossfadeMs: 3000, repeat: "all", policy: "dsp" }),
      );
      events.dispatchEvent(new Event("phemios-settings-loaded"));
      expect(player.crossfade()).toBe(3000);
      expect(player.policy()).toBe("dsp");
      player.reset();
      interfacePreferences.setItem(
        "phemios.audio.v1",
        JSON.stringify({ crossfadeMs: 1000, repeat: "off", policy: "without-effects" }),
      );
      events.dispatchEvent(new Event("phemios-settings-loaded"));
      expect(player.crossfade()).toBe(1000);
      expect(player.policy()).toBe("without-effects");
      dispose();
      interfacePreferences.setItem(
        "phemios.audio.v1",
        JSON.stringify({ crossfadeMs: 9000, repeat: "one", policy: "dsp" }),
      );
      events.dispatchEvent(new Event("phemios-settings-loaded"));
      expect(player.crossfade()).toBe(1000);
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

it("does not apply a pending crossfade acknowledgement or failure to a replaced interface profile", async () => {
  for (const failed of [false, true]) {
    const values = new Map<string, string>();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    await createRoot(async (dispose) => {
      activateInterfaceProfile("alice", (value) => value);
      const player = createPlayback(() => true);
      let complete!: () => void;
      vi.mocked(playbackControl).mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            complete = () => (failed ? reject(new Error("Alice obsolete action")) : resolve());
          }),
      );
      const pending = player.chooseCrossfade(3000);
      activateInterfaceProfile("bob", (value) => value);
      const bob = { crossfadeMs: 5000, repeat: "off", policy: "without-effects" };
      interfacePreferences.setItem("phemios.audio.v1", JSON.stringify(bob));
      window.dispatchEvent(new Event("phemios-settings-loaded"));
      try {
        complete();
        await pending;
        expect(JSON.parse(interfacePreferences.getItem("phemios.audio.v1")!)).toEqual(bob);
        expect(player.crossfade()).toBe(5000);
        expect(player.error()).toBe("");
      } finally {
        dispose();
        vi.unstubAllGlobals();
      }
    });
  }
});

it("does not rewrite a preceding account's duration slot during new-profile hydration", () => {
  const values = new Map<string, string>([["phemios.playback-time:server:alice", "remaining"]]);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  createRoot((dispose) => {
    try {
      activateInterfaceProfile("alice", (value) => value);
      const player = createPlayback(() => false);
      player.identify("server:alice");
      expect(player.remaining()).toBe(true);
      activateInterfaceProfile("bob", (value) => value);
      window.dispatchEvent(new Event("phemios-settings-loaded"));
      expect(player.remaining()).toBe(false);
      expect(values.get("phemios.playback-time:server:alice")).toBe("remaining");
    } finally {
      dispose();
      vi.unstubAllGlobals();
    }
  });
});

it("publishes the replacement album metadata and rejects a prior track poll after switching selections", async () => {
  await createRoot(async (dispose) => {
    const nextAlbum = { ...album, reference: "release:next", title: "Next release" };
    const player = createPlayback(
      () => true,
      () => ({ albums: [album, nextAlbum], artists: [] }),
    );
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
    });
    await player.start(tracks, album, "First artist");
    let oldReply!: (value: unknown) => void;
    vi.mocked(playbackState).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldReply = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(60);
    vi.mocked(requestAede).mockResolvedValueOnce({
      items: [
        {
          reference: "track:next",
          title: "New title",
          release: nextAlbum.reference,
          number: 1,
          album_total: 1,
        },
      ],
    });
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:next",
      total: 1,
      queue: [0],
    });
    await player.startReference(nextAlbum.reference);
    expect(player.current()?.title).toBe("New title");
    expect(player.current()?.album).toBe(nextAlbum);
    oldReply({ ...idlePlayback, status: "playing", reference: "track:one", total: 2 });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(player.current()?.title).toBe("New title");
    expect(player.current()?.album).toBe(nextAlbum);
    expect(player.queue().map((row) => row.reference)).toEqual(["track:next"]);
    dispose();
  });
});

it("publishes a shorter replacement selection atomically with native state for actual queue consumers", async () => {
  await createRoot(async (dispose) => {
    const nextAlbum = { ...album, reference: "release:next", title: "Next release" };
    const player = createPlayback(
      () => true,
      () => ({ albums: [album, nextAlbum], artists: [] }),
    );
    const session = {
      server: "http://127.0.0.1:8787",
      account: { id: "fixture", username: "fixture", role: "auditor" as const },
    };
    createQueueLyrics({
      queue: player.queue,
      sessionFor: (reference) => {
        referenceSource(reference);
        return session;
      },
      tasks: { start: vi.fn(), jobs: () => [] },
    });
    vi.mocked(requestAede).mockImplementation(async (path, query) =>
      path.endsWith("/playback")
        ? {
            items: [
              {
                reference: "track:next",
                title: "New title",
                release: nextAlbum.reference,
                number: 1,
                album_total: 1,
              },
            ],
          }
        : { track: query?.track, lyrics: null },
    );
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      queue: [0, 1],
    });
    await player.start(tracks, album, "Artist");
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:next",
      total: 1,
      queue: [0],
    });
    await player.startReference(nextAlbum.reference);
    expect(playbackStart).toHaveBeenCalledTimes(2);
    expect(player.error()).toBe("");
    expect(player.current()?.title).toBe("New title");
    expect(player.current()?.album).toBe(nextAlbum);
    dispose();
  });
});

it("retains the last confirmed order on Stop and restarts the selected occurrence in that order", async () => {
  await createRoot(async (dispose) => {
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:two",
      total: 2,
      index: 1,
      queue: [1, 0],
    });
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Artist", 1);
    vi.mocked(playbackState).mockResolvedValueOnce({ ...idlePlayback });
    await player.action("stop");
    expect(player.queue().map((row) => row.reference)).toEqual(["track:two", "track:one"]);
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      index: 1,
      queue: [0, 1],
    });
    await player.playQueueOccurrence(0);
    expect(playbackStart).toHaveBeenLastCalledWith(
      ["track:two", "track:one"],
      "",
      1,
      "without-effects",
    );
    expect(player.current()?.title).toBe("First");
    expect(player.queue().map((row) => row.reference)).toEqual(["track:two", "track:one"]);
    dispose();
  });
});

it("does not restart a stopped queue after its account is reset during audio configuration", async () => {
  await createRoot(async (dispose) => {
    vi.mocked(playbackState).mockResolvedValueOnce({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      queue: [0, 1],
    });
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Artist");
    vi.mocked(playbackState).mockResolvedValueOnce({ ...idlePlayback });
    await player.action("stop");
    vi.mocked(playbackStart).mockClear();
    let release!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const pending = player.playQueueOccurrence(0);
    await Promise.resolve();
    player.reset();
    release();
    await pending;
    expect(playbackStart).not.toHaveBeenCalled();
    expect(player.queue()).toEqual([]);
    dispose();
  });
});

it("keeps stopped local rows only while their source is admitted and preserves them on server logout", async () => {
  await createRoot(async (dispose) => {
    const localTracks = tracks.map((track) => ({
      ...track,
      reference: `track:@phemios/local/${track.reference.slice(6)}`,
    }));
    vi.mocked(playbackState)
      .mockResolvedValueOnce({
        ...idlePlayback,
        status: "playing",
        reference: localTracks[0]!.reference,
        total: 2,
        queue: [0, 1],
      })
      .mockResolvedValueOnce(idlePlayback);
    const player = createPlayback(() => true);
    await player.start(localTracks, album, "Artist");
    await player.action("stop");
    expect(player.ownsSource("server")).toBe(false);
    if (player.ownsSource("server")) player.reset();
    expect(player.queue().map((row) => row.reference)).toEqual(
      localTracks.map((track) => track.reference),
    );
    expect(player.ownsSource("local")).toBe(true);
    if (player.ownsSource("local")) player.reset();
    expect(player.queue()).toEqual([]);
    expect(player.ownsSource("server")).toBe(false);
    expect(player.ownsSource("local")).toBe(false);
    dispose();
  });
});

it("clears stopped server rows on exact account replacement without consuming local playback", async () => {
  await createRoot(async (dispose) => {
    vi.mocked(playbackState)
      .mockResolvedValueOnce({
        ...idlePlayback,
        status: "playing",
        reference: "track:one",
        total: 2,
        queue: [0, 1],
      })
      .mockResolvedValueOnce(idlePlayback);
    const player = createPlayback(() => true);
    await player.start(tracks, album, "Private collection owner");
    await player.action("stop");
    expect(player.ownsSource("local")).toBe(false);
    expect(player.ownsSource("server")).toBe(true);
    if (player.ownsSource("server")) player.reset();
    expect(player.queue()).toEqual([]);
    await player.playQueueOccurrence(0);
    expect(playbackStart).toHaveBeenCalledOnce();
    dispose();
  });
});

it("invalidates a pending presentation before account replacement can replay its private selection", async () => {
  await createRoot(async (dispose) => {
    let resolve!: (value: unknown) => void;
    vi.mocked(requestAede).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const player = createPlayback(
      () => true,
      () => ({ albums: [album], artists: [] }),
    );
    const pending = player.startReference("collection:@phemios/local/private");
    expect(player.ownsSource("local")).toBe(true);
    expect(player.ownsSource("server")).toBe(false);
    if (player.ownsSource("local")) player.reset();
    resolve({
      items: [
        {
          reference: "track:one",
          title: "First",
          release: album.reference,
          number: 1,
          album_total: 1,
        },
      ],
    });
    await pending;
    expect(playbackStart).not.toHaveBeenCalled();
    expect(player.queue()).toEqual([]);
    dispose();
  });
});

it.each(["complete", "reset"])(
  "serializes delayed collection admission and preserves its source: %s",
  async (change) => {
    await createRoot(async (dispose) => {
      let finish!: (value: unknown) => void;
      const read = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            finish = resolve;
          }),
      );
      const player = createPlayback(
        () => true,
        () => ({ albums: [album], artists: [] }),
      );
      const pending = player.readSelection(read, "local");
      expect(player.busy()).toBe(true);
      expect(player.ownsSource("local")).toBe(true);
      await player.startReference(album.reference);
      expect(requestAede).not.toHaveBeenCalled();
      if (change === "reset") player.reset();
      vi.mocked(playbackState).mockResolvedValue({
        ...idlePlayback,
        status: "playing",
        reference: "track:one",
        total: 1,
        index: 0,
        queue: [0],
      });
      finish({
        items: [
          {
            reference: "track:one",
            title: "First",
            release: album.reference,
            number: 1,
            album_total: 2,
          },
        ],
      });
      await pending;
      expect(playbackStart).toHaveBeenCalledTimes(change === "complete" ? 1 : 0);
      expect(player.busy()).toBe(false);
      dispose();
    });
  },
);

it("keeps existing playback polling during delayed selection preparation and cancellation", async () => {
  await createRoot(async (dispose) => {
    vi.mocked(playbackState).mockResolvedValue({
      ...idlePlayback,
      status: "playing",
      reference: "track:one",
      total: 2,
      index: 0,
      queue: [0, 1],
    });
    const player = createPlayback(
      () => true,
      () => ({ albums: [album], artists: [] }),
    );
    await player.start(tracks, album, "Artist");
    let finish!: (value: unknown) => void;
    const pending = player.readSelection(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      "server",
    );
    const before = vi.mocked(playbackState).mock.calls.length;
    await vi.advanceTimersByTimeAsync(180);
    expect(vi.mocked(playbackState).mock.calls.length).toBeGreaterThan(before);
    finish(undefined);
    await pending;
    const canceled = vi.mocked(playbackState).mock.calls.length;
    await vi.advanceTimersByTimeAsync(180);
    expect(vi.mocked(playbackState).mock.calls.length).toBeGreaterThan(canceled);
    expect(playbackStart).toHaveBeenCalledTimes(1);
    dispose();
  });
});
