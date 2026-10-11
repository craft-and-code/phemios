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

it("marks listened episodes from actual played ranges, never from a seek or a stale media callback", async () => {
  await createRoot(async (dispose) => {
    const first = fixture(),
      second = fixture(),
      complete = vi.fn();
    let ranges: [number, number][] = [[88, 90]];
    first.media.played = () => ranges;
    second.media.played = () => [[0, 89]];
    const create = vi.fn().mockReturnValueOnce(first.media).mockReturnValueOnce(second.media);
    const player = createPodcastPlayback(async () => {}, create, complete);
    await player.start(feed, feed.episodes[0]!);
    first.time(90, 90);
    first.change("ended");
    expect(complete).not.toHaveBeenCalled();
    ranges = [
      [0, 45],
      [30, 82],
    ];
    first.time(82, 90);
    expect(complete).toHaveBeenCalledExactlyOnceWith(feed.url, feed.episodes[0]!.id);
    first.change("ended");
    expect(complete).toHaveBeenCalledOnce();
    await player.start(feed, feed.episodes[0]!);
    first.time(90, 90);
    first.change("ended");
    expect(complete).toHaveBeenCalledOnce();
    second.time(89, 90);
    expect(complete).toHaveBeenCalledTimes(2);
    dispose();
  });
});

it("applies the idle safety mute before starting an episode and keeps volume between episodes", async () => {
  await createRoot(async (dispose) => {
    const f = fixture();
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
      () => {},
      () => 0,
    );
    await player.start(feed, feed.episodes[0]!);
    expect(f.media.volume).toHaveBeenCalledWith(0);
    expect(vi.mocked(f.media.volume).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(f.media.play).mock.invocationCallOrder[0]!,
    );
    player.changeVolume(0.3);
    await player.start(feed, feed.episodes[0]!);
    expect(f.media.volume).toHaveBeenLastCalledWith(0.3);
    dispose();
  });
});
