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
    expect(factory).not.toHaveBeenCalled();
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
