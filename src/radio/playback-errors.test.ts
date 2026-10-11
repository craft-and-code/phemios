import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import { changeLanguage } from "../i18n";
import { createRadioPlayback, type RadioMedia } from "./playback";
const station = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Test Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
function media(play: () => Promise<void>): RadioMedia {
  return { source: vi.fn(), volume: vi.fn(), release: vi.fn(), callbacks: vi.fn(), play };
}
it.each([
  [
    "fr",
    "Le lecteur système a interrompu le démarrage de cette radio. Réessayez ou choisissez une autre station.",
  ],
  ["en", "The system player interrupted this station's startup. Retry or choose another station."],
] as const)(
  "explains a current native play abort in %s and retains the station for explicit retry",
  async (language, expected) => {
    changeLanguage(language);
    try {
      await createRoot(async (dispose) => {
        const audio = media(async () => {
          throw new DOMException("The operation was aborted.", "AbortError");
        });
        const player = createRadioPlayback(
          async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
          async () => {},
          () => audio,
        );
        try {
          await player.start(station);
          expect(player.status()).toBe("error");
          expect(player.error()).toBe(expected);
          expect(player.station()).toEqual(station);
          expect(audio.release).toHaveBeenCalledOnce();
        } finally {
          dispose();
        }
      });
    } finally {
      changeLanguage("fr");
    }
  },
);
it("ignores an obsolete native play abort after another station has started", async () => {
  await createRoot(async (dispose) => {
    let reject!: (error: unknown) => void;
    const firstPlay = new Promise<void>((_resolve, fail) => {
      reject = fail;
    });
    const previous = media(() => firstPlay),
      current = media(async () => {});
    const factory = vi
      .fn<() => RadioMedia>()
      .mockReturnValueOnce(previous)
      .mockReturnValue(current);
    const next = { ...station, uuid: "87654321-1234-1234-1234-123456789012" };
    let playing = () => {};
    current.callbacks = (ready) => {
      playing = ready;
    };
    current.play = async () => {
      playing();
    };
    const player = createRadioPlayback(
      async (uuid) => ({ stationuuid: uuid, url: "https://radio.example.org/live.mp3" }),
      async () => {},
      factory,
    );
    try {
      const first = player.start(station);
      await Promise.resolve();
      await Promise.resolve();
      await player.start(next);
      reject(new DOMException("The operation was aborted.", "AbortError"));
      await first;
      expect(player.status()).toBe("playing");
      expect(player.station()).toEqual(next);
      expect(player.error()).toBe("");
      expect(previous.release).toHaveBeenCalledOnce();
      expect(current.release).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});
