import { expect, it } from "vitest";
import { cdPlaybackAction, cdReference, cdSelection, cdPlaying, parseCd } from "./model";
const disc = {
  token: "0000000000000002",
  tracks: [{ reference: "track:cd/0000000000000002/7", number: 7, duration_ms: 1234 }],
};
const value = () => ({
  drives: [
    { id: "0000000000000001", name: "Optical drive", error: null, disc: structuredClone(disc) },
  ],
});
it("keeps physical track numbers separate from the queue's ordinal position", () => {
  const parsed = parseCd(value());
  expect(parsed[0]?.disc?.tracks[0]?.number).toBe(7);
  const rows = cdSelection(disc);
  expect(rows[0]).toMatchObject({
    reference: disc.tracks[0]!.reference,
    number: 1,
    albumTotal: 1,
    durationMs: 1234,
    album: null,
  });
});
it("rejects arbitrary paths, remote references and stale disc tokens", () => {
  for (const ref of [
    "/dev/disk0",
    "track:@phemios/server/example",
    "track:cd/0000000000000002/0",
    "track:cd/0000000000000002/100",
  ])
    expect(cdReference(ref)).toBeUndefined();
  const corrupt = value();
  corrupt.drives[0]!.disc.tracks[0]!.reference = "track:cd/0000000000000003/7";
  expect(() => parseCd(corrupt)).toThrow();
});
it("does not fabricate readable music from empty, duplicate or malformed native rows", () => {
  expect(parseCd({ drives: [] })).toEqual([]);
  for (const mutate of [
    (v: ReturnType<typeof value>) => v.drives.push(v.drives[0]!),
    (v: ReturnType<typeof value>) => v.drives[0]!.disc.tracks.push(v.drives[0]!.disc.tracks[0]!),
    (v: ReturnType<typeof value>) => {
      v.drives[0]!.disc.tracks[0]!.duration_ms = -1;
    },
    (v: ReturnType<typeof value>) => {
      v.drives[0]!.disc.tracks = [];
    },
  ]) {
    const v = value();
    mutate(v);
    expect(() => parseCd(v)).toThrow();
  }
});

it("blocks ejection only while the selected disc is starting or playing", () => {
  for (const status of ["playing", "connecting"]) {
    expect(cdPlaying(disc.token, disc.tracks[0]!.reference, status)).toBe(true);
    expect(cdPlaying("0000000000000003", disc.tracks[0]!.reference, status)).toBe(false);
    expect(cdPlaying(undefined, disc.tracks[0]!.reference, status)).toBe(false);
    expect(cdPlaying(disc.token, "track:@phemios/server/example", status)).toBe(false);
  }
  for (const status of ["paused", "idle", "ended", "error"])
    expect(cdPlaying(disc.token, disc.tracks[0]!.reference, status)).toBe(false);
});

it("retains CUE names as local presentation without inventing album/account identities", () => {
  const input = value();
  const image = {
    ...input.drives[0]!,
    image: true,
    disc: {
      ...disc,
      title: "Example",
      artist: "Ensemble",
      tracks: [{ ...disc.tracks[0]!, title: "Movement", artist: "Soloist" }],
    },
  };
  const parsed = parseCd({ drives: [image] });
  expect(parsed[0]?.image).toBe(true);
  expect(cdSelection(parsed[0]!.disc!)[0]).toMatchObject({
    title: "Movement",
    artist: "Soloist",
    album: null,
  });
  image.disc.tracks[0]!.title = "x".repeat(1001);
  expect(() => parseCd({ drives: [image] })).toThrow();
});

it("selects Pause/Resume only for the selected active disc or its current row", () => {
  const token = "0000000000000001",
    reference = `track:cd/${token}/7`;
  expect(cdPlaybackAction(token, reference, "playing")).toBe("pause");
  expect(cdPlaybackAction(token, reference, "connecting")).toBe("pause");
  expect(cdPlaybackAction(token, reference, "paused")).toBe("resume");
  expect(cdPlaybackAction(token, reference, "paused", reference)).toBe("resume");
  expect(cdPlaybackAction(token, reference, "playing", `track:cd/${token}/1`)).toBe("play");
  expect(cdPlaybackAction("0000000000000002", reference, "playing")).toBe("play");
  expect(cdPlaybackAction(token, "track:ordinary", "playing")).toBe("play");
  for (const status of ["idle", "ended", "error"])
    expect(cdPlaybackAction(token, reference, status)).toBe("play");
});
