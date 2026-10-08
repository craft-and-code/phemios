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
    expect(playbackStart).toHaveBeenCalledWith(["track:one", "track:two"], "", 1);
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
    await Promise.resolve();
    await Promise.resolve();
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
