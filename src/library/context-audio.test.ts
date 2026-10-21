import { expect, it, vi } from "vitest";
import { controlAudioShortcut, toggleAudioShortcut } from "../navigation/audio-shortcut";
import { mountLibrary } from "./context-test-fixtures";
import { idlePlayback } from "./playback-state";
import {
  playbackControl,
  playbackStart,
  playbackState,
  startLocal,
  syncAede,
} from "../platform/desktop";
import { browserRadioMedia } from "../radio/playback";
import { browserPodcastMedia } from "../podcasts/playback";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return {
    ...(await mockLibraryDesktop()),
    playbackControl: vi.fn(),
    playbackStart: vi.fn(),
    playbackState: vi.fn(),
    resolveRadio: vi.fn(async (uuid: string) => ({
      stationuuid: uuid,
      url: "https://radio.example/live.mp3",
    })),
  };
});
vi.mock("../radio/playback", async (original) => ({
  ...(await original<typeof import("../radio/playback")>()),
  browserRadioMedia: vi.fn(),
}));
vi.mock("../podcasts/playback", async (original) => ({
  ...(await original<typeof import("../podcasts/playback")>()),
  browserPodcastMedia: vi.fn(),
}));
function mockMedia() {
  const media = {
    source: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    release: vi.fn(),
    volume: vi.fn(),
    seek: vi.fn(),
    callbacks: vi.fn(),
  };
  vi.mocked(browserRadioMedia).mockReturnValue(media);
  vi.mocked(browserPodcastMedia).mockReturnValue(media);
  return media;
}
const station = {
  uuid: "12345678-1234-1234-1234-123456789012",
  name: "Fixture Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
const episode = {
  id: "fixture-episode",
  title: "Fixture Episode",
  url: "https://podcast.example/episode.mp3",
  date: null,
  duration: 60,
  summary: "",
};
const feed = {
  url: "https://podcast.example/feed.xml",
  title: "Fixture Podcast",
  author: "Fixture",
  episodes: [episode],
};

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    (["configuration", "native-start"] as const).map((phase) => ({ source, phase })),
  ),
)(
  "refuses $source admission while an idle-looking music $phase is pending",
  async ({ source, phase }) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let status: "playing" | "idle" = "playing";
    vi.mocked(playbackState).mockImplementation(async () => ({
      ...idlePlayback,
      status,
      reference: status === "playing" ? "track:@phemios/local/one" : "",
      total: status === "playing" ? 1 : 0,
    }));
    vi.mocked(playbackControl).mockImplementation(async (command) => {
      if (command === "stop") status = "idle";
    });
    let finish!: () => void;
    const pending = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    if (phase === "configuration") vi.mocked(playbackControl).mockImplementationOnce(pending);
    else vi.mocked(playbackStart).mockImplementationOnce(pending);
    const album = {
      reference: "release:@phemios/local/one",
      title: "Fixture Release",
      artist: null,
      year: null,
      compilation: false,
      tags: [],
    };
    const starting = library.player.start(
      [{ reference: "track:@phemios/local/one", title: "First", duration_ms: 1000, analyses: [] }],
      album,
      "Fixture Artist",
    );
    const external = () =>
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    try {
      await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
      expect(library.player.busy()).toBe(true);
      expect(library.player.state().status).toBe("idle");
      await external();
      expect(media.play).not.toHaveBeenCalled();
      expect(library[source].error()).toBe(
        "Arrêtez la lecture de la bibliothèque avant de lancer " +
          (source === "radio" ? "la radio." : "le podcast."),
      );
      finish();
      await starting;
      expect(library.player.state().status).toBe("playing");
      await external();
      expect(media.play).toHaveBeenCalledOnce();
      expect(library.player.state().status).toBe("idle");
    } finally {
      finish?.();
      await starting;
    }
  },
);

it.each([
  { source: "radio", retirement: "stop" },
  { source: "podcast", retirement: "stop" },
  { source: "podcast", retirement: "logout" },
] as const)(
  "retires $source handoff during native Stop after $retirement",
  async ({ source, retirement }) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let status: "playing" | "idle" = "playing";
    vi.mocked(playbackControl).mockResolvedValue(undefined);
    vi.mocked(playbackState).mockImplementation(async () => ({
      ...idlePlayback,
      status,
      reference: status === "playing" ? "track:@phemios/local/one" : "",
      total: status === "playing" ? 1 : 0,
    }));
    await library.player.start(
      [{ reference: "track:@phemios/local/one", title: "First", duration_ms: 1000, analyses: [] }],
      {
        reference: "release:@phemios/local/one",
        title: "Fixture",
        artist: null,
        year: null,
        compilation: false,
        tags: [],
      },
      "Fixture Artist",
    );
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            status = "idle";
            resolve();
          };
        }),
    );
    const switching =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    try {
      await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
      expect(media.play).not.toHaveBeenCalled();
      if (retirement === "logout") await library.disableLocal();
      else library[source].stop();
      finish();
      await switching;
      expect(media.play).not.toHaveBeenCalled();
      expect(library[source].status()).toBe("idle");
      expect(library[source].error()).toBe("");
    } finally {
      finish?.();
      await switching;
    }
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    [0, 0.2].map((volume) => ({ source, volume })),
  ),
)("inherits pending volume $volume before admitting $source", async ({ source, volume }) => {
  const library = mountLibrary();
  await library.enableLocal();
  const media = mockMedia();
  let finish!: () => void;
  vi.mocked(playbackControl).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const changing = library.player.volume(volume);
  const switching =
    source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
  try {
    await vi.advanceTimersByTimeAsync(1);
    expect(media.play).not.toHaveBeenCalled();
    finish();
    await changing;
    await switching;
    expect(media.play).toHaveBeenCalledOnce();
    expect(media.volume).toHaveBeenLastCalledWith(volume);
    expect(library[source].volume()).toBe(volume);
  } finally {
    finish?.();
    await changing;
    await switching;
  }
});

it.each(["radio", "podcast"] as const)(
  "keeps a newer %s mute when the preceding native gain replies late",
  async (source) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changing = library.player.volume(0.2);
    await library.player.volume(0.7);
    const switching =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    try {
      await vi.advanceTimersByTimeAsync(1);
      library[source].mute();
      expect(library.player.state().volume).toBe(0);
      finish();
      await changing;
      await switching;
      expect(media.volume).toHaveBeenLastCalledWith(0);
      expect(library.player.state().volume).toBe(0);
      expect(playbackControl).toHaveBeenCalledExactlyOnceWith("volume", 0.2);
    } finally {
      finish?.();
      await changing;
      await switching;
    }
  },
);

it.each([
  { source: "radio", retirement: "stop" },
  { source: "podcast", retirement: "stop" },
  { source: "podcast", retirement: "logout" },
] as const)(
  "retires $source while inherited gain is pending after $retirement",
  async ({ source, retirement }) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changing = library.player.volume(0.2);
    const switching =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    try {
      await vi.advanceTimersByTimeAsync(1);
      if (retirement === "logout") await library.disableLocal();
      else library[source].stop();
      finish();
      await changing;
      await switching;
      expect(media.play).not.toHaveBeenCalled();
      expect(library[source].status()).toBe("idle");
      expect(library[source].error()).toBe("");
    } finally {
      finish?.();
      await changing;
      await switching;
    }
  },
);

it.each(["radio", "podcast"] as const)(
  "retains a pending inherited mute when another %s selection replaces the first",
  async (source) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    const start = (next: boolean) =>
      source === "radio"
        ? library.radio.start(
            next ? { ...station, uuid: "12345678-1234-1234-1234-123456789013" } : station,
          )
        : library.podcast.start(feed, next ? { ...episode, id: "second-episode" } : episode);
    await start(false);
    library[source].stop();
    media.play.mockClear();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changing = library.player.volume(0);
    const first = start(false);
    let second: Promise<void> | undefined;
    try {
      await vi.advanceTimersByTimeAsync(1);
      second = start(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(media.play).not.toHaveBeenCalled();
      finish();
      await changing;
      await first;
      await second;
      expect(media.play).toHaveBeenCalledOnce();
      expect(media.volume).toHaveBeenLastCalledWith(0);
      expect(library[source].volume()).toBe(0);
    } finally {
      finish?.();
      await changing;
      await first;
      await second;
    }
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    [false, true].map((rejected) => ({ source, rejected })),
  ),
)(
  "keeps a newer $source gain across replacement when the old reply is rejected=$rejected",
  async ({ source, rejected }) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = () => (rejected ? reject(new Error("retired gain failure")) : resolve());
        }),
    );
    const changing = library.player.volume(0);
    const first =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    let second: Promise<void> | undefined;
    try {
      await vi.advanceTimersByTimeAsync(1);
      library[source].changeVolume(0.3);
      second =
        source === "radio"
          ? library.radio.start({ ...station, uuid: "12345678-1234-1234-1234-123456789013" })
          : library.podcast.start(feed, { ...episode, id: "second-episode" });
      await second;
      expect(media.play).toHaveBeenCalledOnce();
      expect(media.volume).toHaveBeenLastCalledWith(0.3);
      finish();
      await changing;
      await first;
      expect(media.play).toHaveBeenCalledOnce();
      expect(library[source].volume()).toBe(0.3);
      expect(library.player.state().volume).toBe(0.3);
      expect(library.player.error()).toBe("");
    } finally {
      finish?.();
      await changing;
      await first;
      await second;
    }
  },
);

it.each(["radio", "podcast"] as const)(
  "starts a fresh %s login without awaiting the retired account's gain",
  async (source) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changing = library.player.volume(0.2);
    const first =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    let next: Promise<void> | undefined;
    try {
      await vi.advanceTimersByTimeAsync(1);
      library[source].stop();
      await library.disableLocal();
      await library.enableLocal();
      next =
        source === "radio"
          ? library.radio.start({ ...station, uuid: "12345678-1234-1234-1234-123456789013" })
          : library.podcast.start(feed, { ...episode, id: "second-episode" });
      await next;
      expect(media.play).toHaveBeenCalledOnce();
      expect(library[source].volume()).toBe(0.5);
      finish();
      await changing;
      await first;
      expect(media.play).toHaveBeenCalledOnce();
      expect(library[source].volume()).toBe(0.5);
      expect(library.player.state().volume).toBe(0.5);
    } finally {
      finish?.();
      await changing;
      await first;
      await next;
    }
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    (["mute", "stop"] as const).map((action) => ({ source, action })),
  ),
)(
  "applies $action to the active $source instead of the idle native player",
  async ({ source, action }) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    media.play.mockImplementation(async () => {
      const notify = media.callbacks.mock.lastCall?.[0];
      notify?.(source === "podcast" ? "playing" : undefined);
    });
    if (source === "radio") await library.radio.start(station);
    else await library.podcast.start(feed, episode);
    expect(library[source].status()).toBe("playing");
    vi.mocked(playbackControl).mockClear();
    await controlAudioShortcut(action, library);
    if (action === "mute") {
      expect(library[source].volume()).toBe(0);
      expect(media.volume).toHaveBeenLastCalledWith(0);
    } else {
      expect(library[source].status()).toBe("idle");
      expect(media.release).toHaveBeenCalledOnce();
    }
    expect(playbackControl).not.toHaveBeenCalled();
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    (["mute", "stop"] as const).map((action) => ({ source, action })),
  ),
)(
  "keeps $source $action authoritative while inherited gain replies late",
  async ({ source, action }) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changing = library.player.volume(0.2);
    const switching =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    try {
      await vi.advanceTimersByTimeAsync(1);
      await controlAudioShortcut(action, library);
      finish();
      await changing;
      await switching;
      if (action === "mute") {
        expect(media.play).toHaveBeenCalledOnce();
        expect(media.volume).toHaveBeenLastCalledWith(0);
        expect(library.player.state().volume).toBe(0);
      } else {
        expect(media.play).not.toHaveBeenCalled();
        expect(library[source].status()).toBe("idle");
      }
      expect(playbackControl).toHaveBeenCalledExactlyOnceWith("volume", 0.2);
    } finally {
      finish?.();
      await changing;
      await switching;
    }
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    [false, true].map((accountChanged) => ({ source, accountChanged })),
  ),
)(
  "unmutes $source at the current profile's confirmed gain (account changed=$accountChanged)",
  async ({ source, accountChanged }) => {
    const library = mountLibrary();
    await library.enableLocal();
    mockMedia();
    const start = () =>
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    await start();
    library[source].changeVolume(0.9);
    library[source].stop();
    if (accountChanged) {
      await library.disableLocal();
      const owner = {
        server: "https://fixture.example",
        nativeSession: "replacement-session",
        account: { id: "replacement-admin", username: "replacement-admin", role: "admin" as const },
      };
      vi.mocked(startLocal).mockResolvedValueOnce(owner);
      vi.mocked(syncAede).mockResolvedValueOnce({
        server: owner.server,
        accountId: owner.account.id,
        scannedAt: 1,
        artists: [],
        albums: [],
      });
      await library.enableLocal();
    }
    vi.mocked(playbackControl).mockResolvedValue(undefined);
    await library.player.volume(0.2);
    await library.player.toggleMute();
    expect(library.player.state().volume).toBe(0);
    await start();
    expect(library[source].volume()).toBe(0);
    library[source].mute();
    expect(library[source].volume()).toBe(0.2);
    expect(library.player.state().volume).toBe(0.2);
  },
);

it.each(["radio", "podcast"] as const)(
  "does not replace a connecting %s with the page's contextual album on Space",
  async (source) => {
    const library = mountLibrary();
    await library.enableLocal();
    const media = mockMedia();
    let finish!: () => void;
    vi.mocked(playbackControl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changing = library.player.volume(0.2);
    const switching =
      source === "radio" ? library.radio.start(station) : library.podcast.start(feed, episode);
    try {
      await vi.advanceTimersByTimeAsync(1);
      expect(library[source].status()).toBe("connecting");
      expect(library.player.queue()).toHaveLength(0);
      await toggleAudioShortcut(library, "release:@phemios/local/fixture");
      expect(library[source].status()).toBe("connecting");
      finish();
      await changing;
      await switching;
      expect(media.play).toHaveBeenCalledOnce();
    } finally {
      finish?.();
      await changing;
      await switching;
    }
  },
);
