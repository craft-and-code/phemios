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

it("retains a paused episode when its pending play rejects after an explicit pause", async () => {
  await createRoot(async (dispose) => {
    let reject!: (error: Error) => void;
    const f = fixture();
    vi.mocked(f.media.play).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
    );
    const pending = player.start(feed, feed.episodes[0]!);
    await Promise.resolve();
    player.pause();
    reject(new DOMException("Interrupted by pause", "AbortError"));
    await pending;
    expect(player.status()).toBe("paused");
    expect(player.error()).toBe("");
    expect(f.media.release).not.toHaveBeenCalled();
    await player.resume();
    expect(player.status()).toBe("playing");
    expect(f.media.source).toHaveBeenCalledOnce();
    dispose();
  });
});
it("ignores an older resume rejection after a newer resume succeeds on the same episode", async () => {
  await createRoot(async (dispose) => {
    const f = fixture();
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
    );
    await player.start(feed, feed.episodes[0]!);
    player.pause();
    let reject!: (error: Error) => void;
    vi.mocked(f.media.play).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const older = player.resume();
    player.pause();
    await player.resume();
    reject(new DOMException("Interrupted previous request", "AbortError"));
    await older;
    expect(player.status()).toBe("playing");
    expect(player.error()).toBe("");
    expect(f.media.release).not.toHaveBeenCalled();
    dispose();
  });
});

it("ignores played evidence from a replaced private podcast owner", async () => {
  await createRoot(async (dispose) => {
    let active = true;
    const f = fixture(),
      completed = vi.fn();
    f.media.played = () => [[0, 89]];
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
      completed,
      undefined,
      () => () => active,
    );
    await player.start(feed, feed.episodes[0]!);
    active = false;
    f.time(89, 90);
    f.change("ended");
    expect(completed).not.toHaveBeenCalled();
    dispose();
  });
});

it("authorizes each podcast start and resume, preserving the refusal reason without playing", async () => {
  await createRoot(async (dispose) => {
    const f = fixture(),
      authorize = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(Error("Listening time reached"));
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
      () => {},
      undefined,
      () => () => true,
      authorize,
    );
    try {
      await player.start(feed, feed.episodes[0]!);
      expect(f.media.play).toHaveBeenCalledOnce();
      expect(authorize).toHaveBeenCalledWith({ kind: "podcast", feed: feed.url });
      player.pause();
      await player.resume();
      expect(authorize).toHaveBeenCalledTimes(2);
      expect(f.media.play).toHaveBeenCalledOnce();
      expect(player.status()).toBe("error");
      expect(player.error()).toBe("Listening time reached");
    } finally {
      dispose();
    }
  });
});
it("does not resume a retained podcast after owner replacement or a late cancelled authorization", async () => {
  await createRoot(async (dispose) => {
    const f = fixture();
    let current = true;
    const authorize = vi.fn().mockResolvedValueOnce(undefined);
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
      () => {},
      undefined,
      () => () => current,
      authorize,
    );
    try {
      await player.start(feed, feed.episodes[0]!);
      player.pause();
      let finish!: () => void;
      authorize.mockImplementationOnce(
        () =>
          new Promise<void>((done) => {
            finish = done;
          }),
      );
      const pending = player.resume();
      player.pause();
      finish();
      await pending;
      expect(f.media.play).toHaveBeenCalledOnce();
      expect(player.status()).toBe("paused");
      current = false;
      await player.resume();
      expect(authorize).toHaveBeenCalledTimes(2);
      expect(f.media.play).toHaveBeenCalledOnce();
      expect(player.status()).toBe("idle");
    } finally {
      dispose();
    }
  });
});

it("restores shared volume without writing it back, then remembers user volume and mute", async () => {
  await createRoot(async (dispose) => {
    const remember = vi.fn(),
      f = fixture();
    const player = createPodcastPlayback(
      async () => {},
      () => f.media,
      () => {},
      () => 0.27,
      undefined,
      undefined,
      remember,
    );
    await player.start(feed, feed.episodes[0]!);
    expect(player.volume()).toBe(0.27);
    expect(remember).not.toHaveBeenCalled();
    player.changeVolume(0.31);
    expect(remember).toHaveBeenLastCalledWith(0.31);
    player.mute();
    expect(remember).toHaveBeenLastCalledWith(0);
    dispose();
  });
});
