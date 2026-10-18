import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createScopedFilters, activeFilters, clearFilter } from "./scoped-filters";
import type { Section } from "./routes";
it("isolates browse selections and preserves them on return, with hidden country rails", () => {
  createRoot((dispose) => {
    const [section, setSection] = createSignal<Section>("genres");
    const filters = createScopedFilters(section, () => [1980, 2025]);
    filters.set({ ...filters.value(), genres: ["Metal"], years: [2000, 2010], query: "live" });
    setSection("albums");
    expect(filters.value().query).toBe("");
    expect(filters.value().genres).toBeUndefined();
    expect(filters.value().years).toEqual([1980, 2025]);
    setSection("countries");
    expect(filters.value().mode).toBe("none");
    setSection("genres");
    expect(filters.value().query).toBe("live");
    expect(filters.value().genres).toEqual(["Metal"]);
    filters.select("albums", { years: [2016, 2016], includeUnknownYear: false });
    setSection("albums");
    expect(filters.value().years).toEqual([2016, 2016]);
    dispose();
  });
});
it("shows every restricting criterion and removes one without discarding the others", () => {
  const value = {
    mode: "both" as const,
    years: [2000, 2010] as const,
    alphabet: [1, 3] as const,
    includeUnknownYear: false,
    query: "live",
    countries: ["FR"],
    genres: ["Metal"],
  };
  const rows = activeFilters(value, [1980, 2025]);
  expect(rows.map((row) => row.key)).toEqual([
    "query",
    "years",
    "unknown",
    "alphabet",
    "country:FR",
    "genre:Metal",
  ]);
  expect(clearFilter(value, "country:FR", [1980, 2025]).genres).toEqual(["Metal"]);
  expect(clearFilter(value, "years", [1980, 2025]).years).toEqual([1980, 2025]);
  expect(activeFilters({ ...value, mode: "none" }, [1980, 2025]).map((r) => r.key)).not.toContain(
    "years",
  );
});
it("starts Artists with both rails hidden while retaining explicit choices on return", () => {
  createRoot((dispose) => {
    const [section, setSection] = createSignal<Section>("artists");
    const filters = createScopedFilters(section, () => [1980, 2025]);
    expect(filters.value().mode).toBe("none");
    filters.set({ ...filters.value(), mode: "years" });
    setSection("albums");
    expect(filters.value().mode).toBe("none");
    setSection("artists");
    expect(filters.value().mode).toBe("years");
    dispose();
  });
});

it("keeps the recent-only flag inside Albums and clears it independently of other criteria", () => {
  createRoot((dispose) => {
    const [section, setSection] = createSignal<Section>("albums");
    const filters = createScopedFilters(section, () => [1980, 2026]);
    filters.set({ ...filters.value(), recentOnly: true, query: "live" });
    expect(activeFilters(filters.value(), [1980, 2026]).map((row) => row.key)).toEqual([
      "recent",
      "query",
    ]);
    setSection("artists");
    expect(filters.value().recentOnly).toBeUndefined();
    setSection("albums");
    expect(filters.value().recentOnly).toBe(true);
    expect(clearFilter(filters.value(), "recent", [1980, 2026])).toMatchObject({
      recentOnly: false,
      query: "live",
    });
    dispose();
  });
});

it("starts Albums without rails and keeps an explicit year selection visible", () => {
  createRoot((dispose) => {
    const filters = createScopedFilters(
      () => "albums",
      () => [1970, 2026],
    );
    expect(filters.value().mode).toBe("none");
    filters.select("albums", { mode: "years", years: [2016, 2016] });
    expect(filters.value()).toMatchObject({ mode: "years", years: [2016, 2016] });
    dispose();
  });
});
