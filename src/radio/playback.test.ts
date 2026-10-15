import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import { createRadioPlayback, type RadioMedia } from "./playback";
const station = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Test Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
function media() {
  let playing = () => {};
  const value: RadioMedia = {
    source: vi.fn(),
    volume: vi.fn(),
    play: vi.fn(async () => {
      playing();
    }),
    release: vi.fn(),
    callbacks: (next) => {
      playing = next;
    },
  };
  return value;
}
it("stops library playback before resolving radio and releases live media on pause", async () => {
  await createRoot(async (dispose) => {
    const events: string[] = [],
      audio = media();
    const player = createRadioPlayback(
      async (uuid) => {
        events.push("resolve");
        return { stationuuid: uuid, url: "https://radio.example.org/live.mp3" };
      },
      async () => {
        events.push("stop library");
      },
      () => audio,
    );
    await player.start(station);
    expect(events).toEqual(["stop library", "resolve"]);
    expect(player.status()).toBe("playing");
    player.changeVolume(0.4);
    player.mute();
    expect(player.volume()).toBe(0);
    player.mute();
    expect(player.volume()).toBe(0.4);
    player.pause();
    expect(audio.release).toHaveBeenCalledOnce();
    expect(player.status()).toBe("paused");
    expect(player.station()).toEqual(station);
    player.stop();
    expect(player.station()).toBeUndefined();
    dispose();
  });
});
it("cannot start a stopped station from a late directory response", async () => {
  await createRoot(async (dispose) => {
    let reply!: (value: unknown) => void;
    const response = new Promise((resolve) => {
        reply = resolve;
      }),
      factory = vi.fn(media);
    const player = createRadioPlayback(
      () => response,
      async () => {},
      factory,
    );
    const pending = player.start(station);
    await Promise.resolve();
    player.stop();
    reply({ stationuuid: station.uuid, url: "https://radio.example.org/live.mp3" });
    await pending;
    expect(factory).toHaveBeenCalledOnce();
    const retired = factory.mock.results[0]!.value as RadioMedia;
    expect(retired.source).not.toHaveBeenCalled();
    expect(retired.play).not.toHaveBeenCalled();
    expect(retired.release).toHaveBeenCalledOnce();
    expect(player.status()).toBe("idle");
    dispose();
  });
});
it("reports a refused stream and keeps the selected station available for retry", async () => {
  await createRoot(async (dispose) => {
    const audio = media();
    audio.play = vi.fn().mockRejectedValue(new Error("Unsupported stream"));
    const player = createRadioPlayback(
      async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
      async () => {},
      () => audio,
    );
    await player.start(station);
    expect(player.status()).toBe("error");
    expect(player.error()).toBe("Unsupported stream");
    expect(audio.release).toHaveBeenCalledOnce();
    dispose();
  });
});

it("inherits a preemptive idle mute before audio starts and retains station volume during station changes", async () => {
  await createRoot(async (dispose) => {
    const audio = media();
    const player = createRadioPlayback(
      async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
      async () => {},
      () => audio,
      () => 0,
    );
    await player.start(station);
    expect(audio.volume).toHaveBeenCalledWith(0);
    expect(vi.mocked(audio.volume).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(audio.play).mock.invocationCallOrder[0]!,
    );
    player.changeVolume(0.3);
    await player.start(station);
    expect(audio.volume).toHaveBeenLastCalledWith(0.3);
    dispose();
  });
});

it("keeps the chosen radio gain when retrying an interrupted station", async () => {
  await createRoot(async (dispose) => {
    const audio = media();
    audio.play = vi.fn().mockRejectedValue(new Error("interrupted"));
    const player = createRadioPlayback(
      async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
      async () => {},
      () => audio,
      () => 0.5,
    );
    await player.start(station);
    player.changeVolume(0.2);
    await player.start(station);
    expect(audio.volume).toHaveBeenLastCalledWith(0.2);
    expect(player.volume()).toBe(0.2);
    dispose();
  });
});

it("measures a continuous stall from its first waiting event despite repeated waiting signals", async () => {
  vi.useFakeTimers();
  try {
    await createRoot(async (dispose) => {
      const audio = media();
      let waiting = () => {};
      audio.callbacks = (_playing, next) => {
        waiting = next;
      };
      audio.play = vi.fn(async () => {});
      const player = createRadioPlayback(
        async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
        async () => {},
        () => audio,
      );
      await player.start(station);
      vi.advanceTimersByTime(10_000);
      waiting();
      vi.advanceTimersByTime(10_000);
      expect(player.status()).toBe("error");
      expect(audio.release).toHaveBeenCalledOnce();
      dispose();
    });
  } finally {
    vi.useRealTimers();
  }
});

it("cannot create media from a playback owner which has already been disposed", async () => {
  let player!: ReturnType<typeof createRadioPlayback>;
  const resolve = vi.fn(async (uuid: string) => ({
    stationuuid: uuid,
    url: "https://radio.example.org/live.mp3",
  }));
  const factory = vi.fn(media),
    beforePlay = vi.fn(async () => {});
  createRoot((dispose) => {
    player = createRadioPlayback(resolve, beforePlay, factory);
    dispose();
  });
  await player.start(station);
  expect(beforePlay).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  expect(factory).not.toHaveBeenCalled();
  expect(player.status()).toBe("idle");
});

it("allows a new full stall window after a playing event has recovered the previous one", async () => {
  vi.useFakeTimers();
  try {
    await createRoot(async (dispose) => {
      const audio = media();
      let playing = () => {},
        waiting = () => {};
      audio.callbacks = (ready, stalled) => {
        playing = ready;
        waiting = stalled;
      };
      audio.play = vi.fn(async () => {});
      const player = createRadioPlayback(
        async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
        async () => {},
        () => audio,
      );
      try {
        await player.start(station);
        vi.advanceTimersByTime(19_000);
        playing();
        expect(player.status()).toBe("playing");
        vi.advanceTimersByTime(5_000);
        waiting();
        vi.advanceTimersByTime(19_000);
        expect(player.status()).toBe("connecting");
        vi.advanceTimersByTime(1_000);
        expect(player.status()).toBe("error");
        expect(audio.release).toHaveBeenCalledOnce();
      } finally {
        dispose();
      }
    });
  } finally {
    vi.useRealTimers();
  }
});

it("samples only the playing radio voice and invalidates it on pause or Stop", async () => {
  await createRoot(async (dispose) => {
    const audio = {
      ...media(),
      sample: vi.fn((target: Float32Array) => {
        target.fill(0.25);
        return true;
      }),
    };
    const player = createRadioPlayback(
      async () => ({ stationuuid: station.uuid, url: "https://radio.example.org/live.mp3" }),
      async () => {},
      () => audio,
    );
    const samples = new Float32Array(8);
    expect(player.sample(samples)).toBe(false);
    await player.start(station);
    expect(player.sample(samples)).toBe(true);
    expect(samples[0]).toBe(0.25);
    player.pause();
    expect(player.sample(samples)).toBe(false);
    expect(samples[0]).toBe(0);
    expect(audio.sample).toHaveBeenCalledTimes(1);
    player.stop();
    expect(player.sample(samples)).toBe(false);
    dispose();
  });
});

it("prepares measurement inside the start gesture but never plays a canceled admission", async () => {
  await createRoot(async (dispose) => {
    let finish!: () => void;
    const admission = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const audio = { ...media(), prepare: vi.fn() };
    const resolve = vi.fn(async (uuid: string) => ({
      stationuuid: uuid,
      url: "https://radio.example.org/live.mp3",
    }));
    const player = createRadioPlayback(
      resolve,
      () => admission,
      () => audio,
    );
    const pending = player.start(station);
    expect(audio.prepare).toHaveBeenCalledOnce();
    expect(audio.play).not.toHaveBeenCalled();
    player.stop();
    finish();
    await pending;
    expect(resolve).not.toHaveBeenCalled();
    expect(audio.source).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.release).toHaveBeenCalledOnce();
    dispose();
  });
});

it("authorizes radio immediately before play and authorizes again when resuming", async () => {
  await createRoot(async (dispose) => {
    const events: string[] = [],
      audio = media(),
      authorize = vi.fn(async () => {
        events.push("authorize");
      });
    vi.mocked(audio.play).mockImplementation(async () => {
      events.push("play");
    });
    const player = createRadioPlayback(
      async (uuid) => {
        events.push("resolve");
        return { stationuuid: uuid, url: "https://radio.example.org/live.mp3" };
      },
      async () => {},
      () => audio,
      undefined,
      authorize,
    );
    try {
      await player.start(station);
      expect(events).toEqual(["resolve", "authorize", "play"]);
      player.pause();
      player.resume();
      await vi.waitFor(() => expect(authorize).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
      expect(authorize).toHaveBeenCalledWith({ kind: "radio" });
    } finally {
      dispose();
    }
  });
});
it("never plays after a refused or retired parental admission", async () => {
  await createRoot(async (dispose) => {
    const audio = media(),
      authorize = vi.fn().mockRejectedValueOnce(Error("Radio blocked"));
    const player = createRadioPlayback(
      async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
      async () => {},
      () => audio,
      undefined,
      authorize,
    );
    try {
      await player.start(station);
      expect(player.error()).toBe("Radio blocked");
      expect(audio.play).not.toHaveBeenCalled();
      let resolve!: () => void;
      authorize.mockImplementationOnce(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      );
      const pending = player.start(station);
      await vi.waitFor(() => expect(authorize).toHaveBeenCalledTimes(2));
      player.pause();
      resolve();
      await pending;
      expect(audio.play).not.toHaveBeenCalled();
      expect(player.status()).toBe("paused");
    } finally {
      dispose();
    }
  });
});
