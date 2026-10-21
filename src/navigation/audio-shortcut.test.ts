import { expect, it, vi } from "vitest";
import { idlePlayback, type PlaybackState } from "../library/playback-state";
import { controlAudioShortcut, toggleAudioShortcut } from "./audio-shortcut";
function controls(status: PlaybackState["status"], busy = false) {
  return {
    player: {
      busy: () => busy,
      state: () => ({ ...idlePlayback, status }),
      toggleMute: vi.fn(async () => {}),
      action: vi.fn(async () => true),
    },
    radio: { station: () => undefined, mute: vi.fn(), stop: vi.fn() },
    podcast: { episode: () => undefined, mute: vi.fn(), stop: vi.fn() },
  };
}
it("keeps preemptive native mute available without an active browser source", async () => {
  const audio = controls("idle");
  await controlAudioShortcut("mute", audio);
  expect(audio.player.toggleMute).toHaveBeenCalledOnce();
  expect(audio.player.action).not.toHaveBeenCalled();
});
it.each(["playing", "paused", "ended"] as const)(
  "stops the native %s selection",
  async (status) => {
    const audio = controls(status);
    await controlAudioShortcut("stop", audio);
    expect(audio.player.action).toHaveBeenCalledExactlyOnceWith("stop");
  },
);
it.each(["mute", "stop"] as const)(
  "does not submit native %s during a busy transition",
  async (action) => {
    const audio = controls("playing", true);
    await controlAudioShortcut(action, audio);
    expect(audio.player.toggleMute).not.toHaveBeenCalled();
    expect(audio.player.action).not.toHaveBeenCalled();
  },
);
it.each(["mute", "stop"] as const)(
  "allows browser %s while native preparation remains busy",
  async (action) => {
    const audio = {
      ...controls("idle", true),
      radio: {
        station: () => ({
          uuid: "12345678-1234-1234-1234-123456789012",
          name: "Fixture",
          country: "France",
          tags: "rock",
          codec: "MP3",
          bitrate: 128,
        }),
        mute: vi.fn(),
        stop: vi.fn(),
      },
    };
    await controlAudioShortcut(action, audio);
    expect(audio.radio[action]).toHaveBeenCalledOnce();
    expect(audio.player.toggleMute).not.toHaveBeenCalled();
    expect(audio.player.action).not.toHaveBeenCalled();
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    (["next", "previous"] as const).map((action) => ({ source, action })),
  ),
)(
  "does not navigate a retained native queue while $source owns audio ($action)",
  async ({ source, action }) => {
    const audio = {
      ...controls("ended"),
      radio: {
        station: () =>
          source === "radio"
            ? {
                uuid: "12345678-1234-1234-1234-123456789012",
                name: "Fixture",
                country: "France",
                tags: "rock",
                codec: "MP3",
                bitrate: 128,
              }
            : undefined,
        mute: vi.fn(),
        stop: vi.fn(),
      },
      podcast: {
        episode: () =>
          source === "podcast"
            ? {
                id: "fixture",
                title: "Fixture",
                url: "https://podcast.example/episode.mp3",
                date: null,
                duration: 60,
                summary: "",
              }
            : undefined,
        mute: vi.fn(),
        stop: vi.fn(),
      },
    };
    await controlAudioShortcut(action, audio);
    expect(audio.player.action).not.toHaveBeenCalled();
    expect(audio.radio.stop).not.toHaveBeenCalled();
    expect(audio.podcast.stop).not.toHaveBeenCalled();
  },
);

it.each(
  (["radio", "podcast"] as const).flatMap((source) =>
    (["playing", "paused", "connecting", "error", "ended"] as const)
      .filter((status) => source === "podcast" || status !== "ended")
      .flatMap((status) => [false, true].map((queued) => ({ source, status, queued }))),
  ),
)(
  "matches Play for $source $status while preserving prepared queue=$queued",
  async ({ source, status, queued }) => {
    const audio = {
      player: {
        ...controls("idle").player,
        queue: () =>
          queued
            ? [
                {
                  reference: "track:fixture",
                  title: "Fixture",
                  album: null,
                  artist: "Fixture",
                  number: 1,
                  albumTotal: 1,
                  index: 0,
                },
              ]
            : [],
        togglePlayback: vi.fn(async () => {}),
        startReference: vi.fn(async () => {}),
      },
      radio: {
        station: () =>
          source === "radio"
            ? {
                uuid: "12345678-1234-1234-1234-123456789012",
                name: "Fixture",
                country: "France",
                tags: "rock",
                codec: "MP3",
                bitrate: 128,
              }
            : undefined,
        status: () => (status === "ended" ? ("error" as const) : status),
        pause: vi.fn(),
        resume: vi.fn(),
      },
      podcast: {
        episode: () =>
          source === "podcast"
            ? {
                id: "fixture",
                title: "Fixture",
                url: "https://podcast.example/episode.mp3",
                date: null,
                duration: 60,
                summary: "",
              }
            : undefined,
        status: () => status,
        pause: vi.fn(),
        resume: vi.fn(async () => {}),
      },
    };
    await toggleAudioShortcut(audio, "release:contextual");
    expect(audio.player.togglePlayback).toHaveBeenCalledTimes(queued ? 1 : 0);
    expect(audio[source].pause).toHaveBeenCalledTimes(!queued && status === "playing" ? 1 : 0);
    expect(audio[source].resume).toHaveBeenCalledTimes(
      !queued && ["paused", "error", "ended"].includes(status) ? 1 : 0,
    );
    expect(audio.player.startReference).not.toHaveBeenCalled();
    expect(audio.player.action).not.toHaveBeenCalled();
  },
);

it.each(
  (["idle", "playing", "paused"] as const).flatMap((status) =>
    [false, true].map((busy) => ({ status, busy })),
  ),
)("retains native Space behavior for $status (busy=$busy)", async ({ status, busy }) => {
  const audio = {
    player: {
      ...controls(status, busy).player,
      queue: () => [],
      togglePlayback: vi.fn(async () => {}),
      startReference: vi.fn(async () => {}),
    },
    radio: {
      station: () => undefined,
      status: () => "idle" as const,
      pause: vi.fn(),
      resume: vi.fn(),
    },
    podcast: {
      episode: () => undefined,
      status: () => "idle" as const,
      pause: vi.fn(),
      resume: vi.fn(async () => {}),
    },
  };
  await toggleAudioShortcut(audio, "release:contextual");
  expect(audio.player.startReference).toHaveBeenCalledTimes(!busy && status === "idle" ? 1 : 0);
  expect(audio.player.action).toHaveBeenCalledTimes(!busy && status !== "idle" ? 1 : 0);
  if (!busy && status !== "idle")
    expect(audio.player.action).toHaveBeenCalledWith(status === "playing" ? "pause" : "resume");
});
