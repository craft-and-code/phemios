import { createRoot } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPlayback } from "./playback";
import { idlePlayback } from "./playback-state";
import { playbackState, playbackStart, playbackControl } from "../platform/desktop";
vi.mock("../platform/desktop", () => ({
  playbackState: vi.fn(),
  playbackStart: vi.fn(),
  playbackControl: vi.fn(),
  playbackOutputs: vi.fn(),
  playbackAppend: vi.fn(),
  requestAede: vi.fn(),
}));
const album = {
  reference: "release:fixture",
  title: "Fictional album",
  artist: null,
  year: null,
  compilation: false,
  tags: [],
};
const tracks = [
  { reference: "track:fixture", title: "Fictional track", duration_ms: 5000, analyses: [] },
];
const connecting = {
  ...idlePlayback,
  status: "connecting",
  reference: tracks[0]!.reference,
  total: 1,
  queue: [0],
  queue_id: 1,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps Pause available on an accepted buffering stream without starting a second queue", async () => {
  await createRoot(async (dispose) => {
    try {
      vi.mocked(playbackState).mockResolvedValue(connecting);
      const player = createPlayback(() => true);
      await player.start(tracks, album, "Artist");
      expect(player.busy()).toBe(false);
      expect(player.canTogglePlayback()).toBe(true);
      vi.mocked(playbackControl).mockClear();
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, status: "paused" });
      await player.togglePlayback();
      expect(playbackControl).toHaveBeenCalledExactlyOnceWith("pause", null);
      expect(player.state().status).toBe("paused");
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, status: "playing" });
      await player.togglePlayback();
      expect(playbackControl).toHaveBeenLastCalledWith("resume", null);
      expect(playbackStart).toHaveBeenCalledTimes(1);
    } finally {
      dispose();
    }
  });
});

it("observes local buffering transitions at the active 60ms cadence and retains the paused cadence", async () => {
  await createRoot(async (dispose) => {
    try {
      vi.mocked(playbackState).mockResolvedValue(connecting);
      const player = createPlayback(() => true);
      await player.start(tracks, album, "Artist");
      expect(playbackState).toHaveBeenCalledTimes(1);
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, status: "paused" });
      await vi.advanceTimersByTimeAsync(60);
      expect(player.state().status).toBe("paused");
      expect(playbackState).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(249);
      expect(playbackState).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(playbackState).toHaveBeenCalledTimes(3);
    } finally {
      dispose();
    }
  });
});

it("rejects a pre-Pause poll arriving after the confirmed paused snapshot", async () => {
  await createRoot(async (dispose) => {
    try {
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, status: "playing" });
      const player = createPlayback(() => true);
      await player.start(tracks, album, "Artist");
      let finish!: (value: unknown) => void;
      vi.mocked(playbackState).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      await vi.advanceTimersByTimeAsync(60);
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, status: "paused" });
      await player.togglePlayback();
      expect(player.state().status).toBe("paused");
      finish({ ...connecting, status: "playing" });
      await Promise.resolve();
      await Promise.resolve();
      expect(player.state().status).toBe("paused");
    } finally {
      dispose();
    }
  });
});

it("keeps an unacknowledged Pause serialized and rejects a duplicate click", async () => {
  await createRoot(async (dispose) => {
    try {
      vi.mocked(playbackState).mockResolvedValue(connecting);
      const player = createPlayback(() => true);
      await player.start(tracks, album, "Artist");
      let finish!: () => void;
      vi.mocked(playbackControl).mockClear();
      vi.mocked(playbackControl).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve(undefined);
          }),
      );
      const pending = player.togglePlayback();
      expect(player.canTogglePlayback()).toBe(false);
      await player.togglePlayback();
      expect(playbackControl).toHaveBeenCalledTimes(1);
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, status: "paused" });
      finish();
      await pending;
      expect(player.canTogglePlayback()).toBe(true);
      expect(player.state().status).toBe("paused");
    } finally {
      dispose();
    }
  });
});

it("retains the bounded 250ms network poll cadence for a buffering HQPlayer output", async () => {
  await createRoot(async (dispose) => {
    try {
      vi.mocked(playbackState).mockResolvedValue({ ...connecting, device: "@hqplayer" });
      const player = createPlayback(() => true);
      await player.start(tracks, album, "Artist");
      await vi.advanceTimersByTimeAsync(249);
      expect(playbackState).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(playbackState).toHaveBeenCalledTimes(2);
    } finally {
      dispose();
    }
  });
});
