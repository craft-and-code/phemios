import { createRoot } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { createPodcastPlayback, type PodcastMedia } from "./playback";
import { feed } from "./test-fixtures";
afterEach(() => vi.useRealTimers());
function fixture() {
  let change!: (status: "playing" | "connecting" | "ended" | "error") => void,
    time!: (p: number, d: number) => void;
  const media: PodcastMedia = {
    source: vi.fn(),
    play: vi.fn(async () => {
      change("playing");
    }),
    pause: vi.fn(),
    release: vi.fn(),
    volume: vi.fn(),
    seek: vi.fn(),
    callbacks: (c, t) => {
      change = c;
      time = t;
    },
  };
  return {
    media,
    change: (s: Parameters<typeof change>[0]) => change(s),
    time: (p: number, d: number) => time(p, d),
  };
}
it("pauses and resumes the same finite episode, seeks, mutes and keeps catalogue history separate", async () => {
  await createRoot(async (dispose) => {
    const f = fixture(),
      before = vi.fn(async () => {}),
      create = vi.fn(() => f.media),
      player = createPodcastPlayback(before, create);
    await player.start(feed, feed.episodes[0]!);
    expect(player.status()).toBe("playing");
    expect(before).toHaveBeenCalledOnce();
    f.time(40, 90);
    player.pause();
    expect(player.position()).toBe(40);
    expect(f.media.release).not.toHaveBeenCalled();
    f.change("connecting");
    expect(player.status()).toBe("paused");
    await player.resume();
    expect(create).toHaveBeenCalledOnce();
    expect(f.media.source).toHaveBeenCalledOnce();
    player.seek(50);
    expect(f.media.seek).toHaveBeenCalledWith(50);
    player.seek(100);
    expect(f.media.seek).toHaveBeenCalledOnce();
    player.changeVolume(0.7);
    player.mute();
    expect(player.volume()).toBe(0);
    player.mute();
    expect(player.volume()).toBe(0.7);
    player.stop();
    expect(player.episode()).toBeUndefined();
    expect(f.media.release).toHaveBeenCalledOnce();
    dispose();
  });
});
it("ignores a late start after Stop and releases interrupted or stalled audio", async () => {
  vi.useFakeTimers();
  await createRoot(async (dispose) => {
    let finish!: () => void;
    const f = fixture(),
      create = vi.fn(() => f.media),
      before = vi.fn(
        () =>
          new Promise<void>((r) => {
            finish = r;
          }),
      ),
      player = createPodcastPlayback(before, create);
    const pending = player.start(feed, feed.episodes[0]!);
    player.stop();
    finish();
    await pending;
    expect(create).not.toHaveBeenCalled();
    before.mockResolvedValue(undefined);
    await player.start(feed, feed.episodes[0]!);
    f.change("connecting");
    await vi.advanceTimersByTimeAsync(20000);
    expect(player.status()).toBe("error");
    expect(player.error()).not.toBe("");
    expect(f.media.release).toHaveBeenCalledOnce();
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
