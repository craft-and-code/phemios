import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createRadioPlayback, type RadioMedia } from "./playback";
import { createRadioDialTransport } from "./dial-transport";
const station = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Fictional radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
function setup(
  resolve: (uuid: string) => Promise<unknown> = async (uuid) => ({
    stationuuid: uuid,
    url: "https://radio.example.org/live.mp3",
  }),
) {
  let playing = () => {};
  const audio: RadioMedia = {
    source: vi.fn(),
    volume: vi.fn(),
    release: vi.fn(),
    callbacks: (next) => {
      playing = next;
    },
    play: vi.fn(async () => {
      playing();
    }),
  };
  const radio = createRadioPlayback(
    resolve,
    async () => {},
    () => audio,
  );
  const [selected, select] = createSignal<typeof station | undefined>(station);
  const [busy, setBusy] = createSignal(false);
  const dial = createRadioDialTransport(selected, radio, busy);
  return { radio, audio, dial, select, setBusy };
}
it("reflects row-started playback and stops the real stream from the dial, even during a directory read", async () => {
  await createRoot(async (dispose) => {
    try {
      const view = setup();
      expect(view.dial.stopping()).toBe(false);
      await view.radio.start(station); // The station list owns this initial Play.
      expect(view.dial.stopping()).toBe(true);
      view.setBusy(true);
      expect(view.dial.disabled()).toBe(false);
      view.dial.activate();
      expect(view.audio.release).toHaveBeenCalledOnce();
      expect(view.radio.status()).toBe("idle");
      expect(view.dial.stopping()).toBe(false);
      expect(view.dial.disabled()).toBe(true);
      view.setBusy(false);
      view.dial.activate();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(view.radio.status()).toBe("playing");
    } finally {
      dispose();
    }
  });
});
it("cancels a connecting stream and refuses its late resolution", async () => {
  await createRoot(async (dispose) => {
    try {
      let reply!: (value: unknown) => void;
      const pending = new Promise((resolve) => {
        reply = resolve;
      });
      const view = setup(() => pending);
      const start = view.radio.start(station);
      await Promise.resolve();
      expect(view.dial.stopping()).toBe(true);
      expect(view.dial.disabled()).toBe(false);
      view.dial.activate();
      reply({ stationuuid: station.uuid, url: "https://radio.example.org/live.mp3" });
      await start;
      expect(view.audio.play).not.toHaveBeenCalled();
      expect(view.radio.status()).toBe("idle");
      expect(view.dial.stopping()).toBe(false);
    } finally {
      dispose();
    }
  });
});
it("shows Play after footer pause/stop and for another selected station; empty selection cannot start", async () => {
  await createRoot(async (dispose) => {
    try {
      const view = setup();
      await view.radio.start(station);
      view.radio.pause();
      expect(view.dial.stopping()).toBe(false);
      view.radio.stop();
      expect(view.dial.stopping()).toBe(false);
      await view.radio.start(station);
      view.select({ ...station, uuid: "12345678-1234-1234-1234-123456789013" });
      expect(view.dial.stopping()).toBe(false);
      view.select(undefined);
      expect(view.dial.disabled()).toBe(true);
      view.dial.activate();
      expect(view.radio.station()?.uuid).toBe(station.uuid);
    } finally {
      dispose();
    }
  });
});
