import { createRoot } from "solid-js";
import { expect, it, vi } from "vitest";
import {
  createToolPreferences,
  readToolPreferences,
  saveToolPreferences,
} from "./tool-preferences";
const store = () => {
  let held: string | null = null;
  return {
    getItem: () => held,
    setItem: (_key: string, value: string) => {
      held = value;
    },
  };
};
it("retains scan and enrichment options together with the chosen track display size", () => {
  const storage = store();
  saveToolPreferences(storage, { full: true, threads: 8 });
  saveToolPreferences(storage, { lyrics: true, excluded: ["server"], trackPageSize: 100 });
  expect(readToolPreferences(storage)).toMatchObject({
    full: true,
    threads: 8,
    lyrics: true,
    excluded: ["server"],
    trackPageSize: 100,
  });
});
it("preserves corrupt stores and refuses invalid choices instead of overwriting them", () => {
  const storage = store();
  storage.setItem("", "bad");
  expect(() => saveToolPreferences(storage, { full: true })).toThrow();
  expect(storage.getItem()).toBe("bad");
  for (const patch of [{ threads: -1 }, { trackPageSize: 10000 }, { threads: 2.5 }])
    expect(() => saveToolPreferences(store(), patch)).toThrow();
});
it("does not change the selected setting when saving fails", () => {
  const prefs = createToolPreferences({
    getItem: () => null,
    setItem: () => {
      throw new Error("Disk full");
    },
  });
  prefs.update({ trackPageSize: 100 });
  expect(prefs.value().trackPageSize).toBe(50);
  expect(prefs.error()).toContain("Disk full");
});

it("migrates enrichment choices with Discogs disabled and persists its explicit selection", () => {
  const storage = store();
  saveToolPreferences(storage, { discogs: true });
  expect(readToolPreferences(storage).discogs).toBe(true);
  storage.setItem(
    "phemios.tools.v1",
    JSON.stringify({
      full: false,
      threads: 0,
      summaries: true,
      covers: true,
      fanart: false,
      lyrics: false,
      excluded: [],
      trackPageSize: 50,
    }),
  );
  expect(readToolPreferences(storage).discogs).toBe(false);
  expect(() => saveToolPreferences(storage, { discogs: 42 as unknown as boolean })).toThrow();
});

it("shows missing releases by default, migrates old stores and saves the choice without changing other options", () => {
  const storage = store();
  expect(readToolPreferences(storage).showMissingAlbums).toBe(true);
  saveToolPreferences(storage, { threads: 4 });
  const old = JSON.parse(storage.getItem()!);
  delete old.showMissingAlbums;
  storage.setItem("", JSON.stringify(old));
  expect(readToolPreferences(storage).showMissingAlbums).toBe(true);
  saveToolPreferences(storage, { showMissingAlbums: false });
  expect(readToolPreferences(storage)).toMatchObject({ showMissingAlbums: false, threads: 4 });
  expect(() =>
    saveToolPreferences(storage, { showMissingAlbums: "false" as unknown as boolean }),
  ).toThrow();
  expect(readToolPreferences(storage).showMissingAlbums).toBe(false);
});

it("migrates cover sizing and persists bounded per-view overrides without losing other choices", () => {
  const storage = store();
  expect(readToolPreferences(storage)).toMatchObject({ coverSize: 150, coverSizes: {} });
  saveToolPreferences(storage, { coverSize: 180, coverSizes: { albums: 220 }, full: true });
  expect(readToolPreferences(storage)).toMatchObject({
    coverSize: 180,
    coverSizes: { albums: 220 },
    full: true,
  });
  saveToolPreferences(storage, { coverSize: 200, coverSizes: {} });
  expect(readToolPreferences(storage).coverSizes).toEqual({});
  for (const patch of [
    { coverSize: 90 },
    { coverSize: 151 },
    { coverSize: 290 },
    { coverSizes: { albums: 1000 } },
    { coverSizes: { radio: 150 } },
  ])
    expect(() => saveToolPreferences(storage, patch as never)).toThrow();
  const legacy = JSON.parse(storage.getItem()!);
  delete legacy.coverSize;
  delete legacy.coverSizes;
  storage.setItem("", JSON.stringify(legacy));
  expect(readToolPreferences(storage)).toMatchObject({
    coverSize: 150,
    coverSizes: {},
    full: true,
  });
});

it("updates mounted cover controls when settings change elsewhere without sending a second write", () => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const storage = store();
  let dispose!: () => void;
  const [first, second] = createRoot((cleanup) => {
    dispose = cleanup;
    return [createToolPreferences(storage), createToolPreferences(storage)] as const;
  });
  first.update({ coverSizes: { albums: 220 } });
  expect(second.value().coverSizes.albums).toBe(220);
  second.update({ coverSize: 180, coverSizes: {} });
  expect(first.value()).toMatchObject({ coverSize: 180, coverSizes: {} });
  dispose();
  vi.unstubAllGlobals();
});

it("persists all artist presentations and migrates existing account choices", () => {
  const storage = store();
  expect(readToolPreferences(storage).artistView).toBe("discography");
  for (const artistView of ["editorial", "discography"] as const) {
    saveToolPreferences(storage, { artistView });
    expect(readToolPreferences(storage).artistView).toBe(artistView);
  }
  const legacy = JSON.parse(storage.getItem()!);
  legacy.artistView = "portrait";
  storage.setItem("", JSON.stringify(legacy));
  expect(readToolPreferences(storage).artistView).toBe("discography");
  delete legacy.artistView;
  storage.setItem("", JSON.stringify(legacy));
  expect(readToolPreferences(storage).artistView).toBe("discography");
  expect(() => saveToolPreferences(storage, { artistView: "unknown" as never })).toThrow();
  expect(readToolPreferences(storage).artistView).toBe("discography");
});
