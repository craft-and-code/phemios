import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { cdIdentification, createCdIdentification } from "./identification";
import type { CdDrive } from "./model";
const token = "0000000000000001";
function drive(id = token): CdDrive {
  return {
    id: "000000000000000a",
    name: "CD",
    error: null,
    disc: {
      token: id,
      tracks: [
        { reference: `track:cd/${id}/1`, number: 1, duration_ms: 1000 },
        { reference: `track:cd/${id}/2`, number: 2, duration_ms: 2000 },
      ],
    },
  };
}
function result(id = token) {
  return {
    token: id,
    metadata: {
      status: "matched",
      title: "Night Signals",
      artist: "Ensemble",
      tracks: [
        { title: "Opening", artist: "Ensemble" },
        { title: "Finale", artist: "Guest" },
      ],
    },
  };
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
it("checks token, complete row count and bounded public text before admitting names", () => {
  const disc = drive().disc!;
  expect(cdIdentification(result(), disc).status).toBe("matched");
  expect(() => cdIdentification(result("0000000000000002"), disc)).toThrow();
  const short = result();
  short.metadata.tracks.pop();
  expect(() => cdIdentification(short, disc)).toThrow();
  const hostile = result();
  hostile.metadata.tracks[0]!.title = "Bad\nname";
  expect(() => cdIdentification(hostile, disc)).toThrow();
});
it("automatically identifies once, preserves embedded names and never changes track references", async () => {
  const raw = drive();
  raw.disc!.title = "CD-Text album";
  raw.disc!.tracks[0]!.title = "CD-Text track";
  const lookup = vi.fn(async () => result());
  const state = createRoot((dispose) => ({
    dispose,
    model: createCdIdentification(() => [raw], lookup),
  }));
  await settle();
  expect(lookup).toHaveBeenCalledExactlyOnceWith(token);
  const disc = state.model.drives()[0]!.disc!;
  expect(disc.title).toBe("CD-Text album");
  expect(disc.tracks[0]!.title).toBe("CD-Text track");
  expect(disc.tracks[1]!.title).toBe("Finale");
  expect(disc.tracks[1]!.reference).toBe(raw.disc!.tracks[1]!.reference);
  expect(state.model.message(token)).toContain("MusicBrainz");
  state.dispose();
});
it("skips images and discs with all embedded titles", async () => {
  const image = drive();
  image.image = true;
  const named = drive("0000000000000002");
  named.disc!.tracks.forEach((track) => (track.title = "Embedded"));
  const lookup = vi.fn();
  const state = createRoot((dispose) => ({
    dispose,
    model: createCdIdentification(() => [image, named], lookup),
  }));
  await settle();
  expect(lookup).not.toHaveBeenCalled();
  state.dispose();
});
it("retires a replaced disc and continues with the new token without overlap", async () => {
  let finish!: (v: unknown) => void;
  const lookup = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(result("0000000000000002"));
  const [drives, setDrives] = createSignal([drive()]);
  const state = createRoot((dispose) => ({
    dispose,
    model: createCdIdentification(drives, lookup),
  }));
  setDrives([drive("0000000000000002")]);
  expect(lookup).toHaveBeenCalledTimes(1);
  finish(result());
  await settle();
  expect(lookup).toHaveBeenCalledTimes(2);
  expect(state.model.drives()[0]!.disc!.token).toBe("0000000000000002");
  expect(state.model.drives()[0]!.disc!.tracks[1]!.title).toBe("Finale");
  state.dispose();
});
it("cancellation and disposal discard late replies without turning an unknown name into an error", async () => {
  for (const disposeFirst of [false, true]) {
    let finish!: (v: unknown) => void;
    const state = createRoot((dispose) => ({
      dispose,
      model: createCdIdentification(
        () => [drive()],
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    }));
    if (disposeFirst) state.dispose();
    else state.model.cancel();
    finish(result());
    await settle();
    expect(state.model.drives()[0]!.disc!.tracks[0]!.title).toBeUndefined();
    expect(state.model.message(token)).not.toContain("complétés");
    state.dispose();
  }
});
it("network failure keeps original playable rows and never retries on mere rerender", async () => {
  const [drives, setDrives] = createSignal([drive()]);
  const lookup = vi.fn(async () => {
    throw Error("offline");
  });
  const state = createRoot((dispose) => ({
    dispose,
    model: createCdIdentification(drives, lookup),
  }));
  await settle();
  setDrives([drive()]);
  await settle();
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(state.model.drives()[0]!.disc!.tracks).toHaveLength(2);
  expect(state.model.message(token)).toContain("lecture reste disponible");
  state.dispose();
});
