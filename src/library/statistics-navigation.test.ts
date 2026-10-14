import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { statisticsSelection } from "./statistics-navigation";
import { createScopedFilters } from "../navigation/scoped-filters";
import { parseSnapshot } from "./server";
import { filterAlbums } from "./filtering";
import type { Section } from "../navigation/routes";
import type { Album } from "./types";
it("opens every dated album in the chosen decade with unrelated facets cleared", () => {
  createRoot((dispose) => {
    const [section, setSection] = createSignal<Section>("albums");
    const scoped = createScopedFilters(section, () => [1980, 2020]);
    scoped.set({
      ...scoped.value(),
      countries: ["France"],
      genres: ["Metal"],
      query: "unrelated",
      mode: "both",
      alphabet: [1, 1],
    });
    const target = statisticsSelection("decade", "1990")!;
    scoped.select(target.section, target.filters);
    setSection(target.section);
    const albums: Album[] = [1989, 1990, 1999, 2000, null].map((year, i) => ({
      reference: String(i),
      title: `Release ${i}`,
      artist: null,
      year,
      compilation: false,
      tags: [],
    }));
    expect(filterAlbums(albums, [], scoped.value()).map((a) => a.reference)).toEqual(["1", "2"]);
    expect(scoped.value().years).toEqual([1990, 1999]);
    dispose();
  });
});
it("opens a country without inheriting a previous country's facets", () => {
  createRoot((dispose) => {
    const [section, setSection] = createSignal<Section>("countries");
    const scoped = createScopedFilters(section, () => [1980, 2020]);
    scoped.set({
      ...scoped.value(),
      countries: ["France"],
      genres: ["Metal"],
      query: "old",
      mode: "years",
      years: [2000, 2001],
    });
    const target = statisticsSelection("country", "United Kingdom")!;
    scoped.select(target.section, target.filters);
    setSection(target.section);
    expect(scoped.value()).toMatchObject({
      countries: ["United Kingdom"],
      mode: "none",
      query: "",
    });
    expect(scoped.value().genres).toBeUndefined();
    dispose();
  });
});
it("does not invent a decade range for undated or malformed statistics", () => {
  for (const value of ["No year", "", "1991", "1990s", "-10", "Infinity", "1990junk"])
    expect(statisticsSelection("decade", value)).toBeUndefined();
  expect(statisticsSelection("country", "")).toBeUndefined();
});

it("matches the unlocalized country bucket to the parsed display country", () => {
  const snapshot = parseSnapshot({
    server: "http://fictional.local",
    accountId: "test",
    scannedAt: 1,
    artists: [
      {
        reference: "artist:example",
        name: "Example",
        genre: "Rock",
        country: "GB",
        country_code: "GB",
        origin: { area: "London" },
        biography: "",
        release_refs: [],
        genres: ["Rock"],
      },
    ],
    albums: [],
  });
  expect(snapshot.artists[0]!.country).toBe("Royaume-Uni");
  expect(
    statisticsSelection("country", "United Kingdom", snapshot.artists)?.filters.countries,
  ).toEqual(["Royaume-Uni"]);
  expect(statisticsSelection("country", "London", snapshot.artists)?.filters.countries).toEqual([
    "Royaume-Uni",
  ]);
});
