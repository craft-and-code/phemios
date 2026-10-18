import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createBiographyReading } from "./biography-reading-state";
import { article } from "../encyclopedia/wikipedia.test-fixtures";
import type { Artist } from "./types";
const artist: Artist = {
  reference: "artist:first",
  name: "First",
  biography: "Short",
  genre: "",
  country: null,
  artwork: false,
  biographyCredit: {
    url: "https://fr.wikipedia.org/wiki/Exact_title",
    lang: "fr",
    licence: "CC BY-SA",
  },
};
it("never fetches on navigation, suppresses duplicate clicks and retains exact title provenance", async () => {
  let dispose = () => {},
    calls = 0,
    finish!: (value: unknown) => void;
  const state = createRoot((stop) => {
    dispose = stop;
    return createBiographyReading(
      () => artist,
      async (lang, title) => {
        calls++;
        expect([lang, title]).toEqual(["fr", "Exact title"]);
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    );
  });
  expect(calls).toBe(0);
  const pending = state.open();
  await state.open();
  expect(calls).toBe(1);
  expect(state.busy()).toBe(true);
  finish(article);
  await pending;
  expect(state.reading()).toEqual(article);
  expect(state.busy()).toBe(false);
  dispose();
});
it("discards stale successes and errors after an artist switch, return or unmount", async () => {
  for (const transition of ["artist", "source", "back", "dispose"]) {
    let dispose = () => {},
      setArtist!: (value: Artist) => void,
      finish!: (value: unknown) => void,
      fail!: (value: unknown) => void;
    const state = createRoot((stop) => {
      dispose = stop;
      const [value, set] = createSignal(artist);
      setArtist = set;
      return createBiographyReading(
        value,
        () =>
          new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
      );
    });
    const pending = state.open();
    if (transition === "artist") setArtist({ ...artist, reference: "artist:second" });
    else if (transition === "source")
      setArtist({
        ...artist,
        biographyCredit: {
          ...artist.biographyCredit!,
          url: "https://fr.wikipedia.org/wiki/Other_title",
        },
      });
    else if (transition === "back") state.back();
    else dispose();
    if (transition === "back") fail(new Error("old response"));
    else finish(article);
    await pending;
    expect(state.reading()).toBeUndefined();
    expect(state.error()).toBe("");
    dispose();
  }
});
it("reports wrong-edition articles without publishing them", async () => {
  let dispose = () => {};
  const state = createRoot((stop) => {
    dispose = stop;
    return createBiographyReading(
      () => artist,
      async () => ({ ...article, language: "en" }),
    );
  });
  await state.open();
  expect(state.reading()).toBeUndefined();
  expect(state.error()).toContain("invalide");
  dispose();
});

it("shows retained text before revision validation and preserves it with visible offline feedback", async () => {
  let dispose = () => {},
    reject!: (failure: Error) => void;
  const state = createRoot((stop) => {
    dispose = stop;
    return createBiographyReading(
      () => artist,
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
      async () => article,
    );
  });
  const pending = state.open();
  await Promise.resolve();
  expect(state.reading()).toEqual(article);
  expect(state.busy()).toBe(true);
  reject(new Error("offline"));
  await pending;
  expect(state.reading()).toEqual(article);
  expect(state.error()).toContain("offline");
  expect(state.busy()).toBe(false);
  state.back();
  expect(state.reading()).toBeUndefined();
  dispose();
});
it("does not revalidate or publish a cache reply after return or artist replacement", async () => {
  for (const transition of ["back", "artist"]) {
    let dispose = () => {},
      finish!: (value: unknown) => void,
      calls = 0,
      change!: (value: Artist) => void;
    const state = createRoot((stop) => {
      dispose = stop;
      const [selected, set] = createSignal(artist);
      change = set;
      return createBiographyReading(
        selected,
        async () => {
          calls++;
          return article;
        },
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    });
    const pending = state.open();
    if (transition === "back") state.back();
    else change({ ...artist, reference: "artist:other" });
    finish(article);
    await pending;
    expect(state.reading()).toBeUndefined();
    expect(calls).toBe(0);
    dispose();
  }
});

it("retains the displayed object after unchanged revalidation so sections do not remount", async () => {
  let dispose = () => {},
    finish!: (value: unknown) => void;
  const state = createRoot((stop) => {
    dispose = stop;
    return createBiographyReading(
      () => artist,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      async () => article,
    );
  });
  const pending = state.open();
  await Promise.resolve();
  const displayed = state.reading();
  finish({ ...article });
  await pending;
  expect(state.reading()).toBe(displayed);
  dispose();
});
