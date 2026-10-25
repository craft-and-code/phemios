import { expect, it } from "vitest";
import { playbackDisplay } from "./playback-display";
import { playbackSelection, queueAdditionSelection } from "./playback-selection";
import { idlePlayback } from "./playback-state";
import type { PlaybackState } from "./playback-state";

const albums = ["first", "second"].map((id) => ({
  reference: `release:${id}`,
  title: id,
  artist: null,
  year: null,
  compilation: false,
  tags: [],
}));
const items = albums.map((album, index) => ({
  reference: `track:${index}`,
  title: `Track ${index}`,
  release: album.reference,
  number: index + 1,
  album_total: 2,
}));
const queue = playbackSelection({ items }, albums, []);

it("shows the first appended album while leaving the idle playback identity empty", () => {
  expect(playbackDisplay(undefined, idlePlayback, queue)?.album).toBe(albums[0]);
  expect(idlePlayback.reference).toBe("");
  expect(idlePlayback.status).toBe("idle");
});

it("uses the album of an exact track addition with its original album position", () => {
  const selection = queueAdditionSelection({ items }, albums, [], "track:1");
  expect(playbackDisplay(undefined, idlePlayback, selection)?.album).toBe(albums[1]);
  expect(selection[0]).toMatchObject({ reference: "track:1", number: 2, albumTotal: 2 });
});

it("follows prepared occurrence order and releases the preview when the queue is emptied", () => {
  expect(playbackDisplay(undefined, idlePlayback, [...queue].reverse())?.album).toBe(albums[1]);
  expect(playbackDisplay(undefined, idlePlayback, queue.slice(1))?.album).toBe(albums[1]);
  expect(playbackDisplay(undefined, idlePlayback, [])).toBeUndefined();
});

it.each<PlaybackState["status"]>(["playing", "paused", "connecting", "ended", "error"])(
  "keeps the actual current cover in the %s state after another album is appended",
  (status) => {
    expect(playbackDisplay(queue[1], { status, reference: "track:1" }, queue)?.album).toBe(
      albums[1],
    );
    expect(playbackDisplay(undefined, { status, reference: "" }, queue)).toBeUndefined();
  },
);

it("retains a stopped track cover and never substitutes a prepared album for missing active metadata", () => {
  const state = { ...idlePlayback, reference: "track:1" };
  expect(playbackDisplay(queue[1], state, queue)?.album).toBe(albums[1]);
  expect(playbackDisplay(undefined, state, queue)).toBeUndefined();
  expect(playbackDisplay({ ...queue[1]!, album: null }, state, queue)?.album).toBeNull();
});

it("does not borrow a later album cover for a first queued track without an album", () => {
  const orphan = { ...queue[0]!, album: null };
  expect(playbackDisplay(undefined, idlePlayback, [orphan, ...queue])).toBe(orphan);
  expect(playbackDisplay(undefined, idlePlayback, [orphan, ...queue])?.album).toBeNull();
});

it("previews the first track title and artist together with its cover in edited order", () => {
  const first = { ...queue[0]!, title: "Opening track", artist: "First artist" };
  const second = { ...queue[1]!, title: "Other track", artist: "Second artist" };
  expect(playbackDisplay(undefined, idlePlayback, [first, second])).toMatchObject({
    title: "Opening track",
    artist: "First artist",
    album: albums[0],
  });
  expect(playbackDisplay(undefined, idlePlayback, [second, first])).toMatchObject({
    title: "Other track",
    artist: "Second artist",
    album: albums[1],
  });
});

it("keeps current track metadata authoritative after another album is added", () => {
  const current = { ...queue[1]!, title: "Current track", artist: "Current artist" };
  for (const status of ["playing", "paused"] as const)
    expect(playbackDisplay(current, { status, reference: current.reference }, queue)).toBe(current);
});
