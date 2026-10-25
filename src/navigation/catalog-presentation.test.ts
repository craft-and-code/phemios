import { createRoot, createSignal } from "solid-js";
import { expect, it } from "vitest";
import { createCatalogPresentation, supportsCoverFlow } from "./catalog-presentation";
import type { FilterScope } from "./scoped-filters";
const pin = "collection:11111111-1111-4111-8111-111111111111" as const;
it("keeps Compilations in a grid initially and retains existing album/collection Cover Flow defaults", () => {
  createRoot((dispose) => {
    const [scope, setScope] = createSignal<FilterScope>("albums");
    const view = createCatalogPresentation(scope);
    expect(view.value()).toBe("cover-flow");
    for (const next of ["compilations", "genres", "artists"] as const) {
      setScope(next);
      expect(view.value()).toBe("grid");
      expect(view.resizable()).toBe(true);
    }
    for (const next of ["composers", pin] as const) {
      setScope(next);
      expect(view.value()).toBe("cover-flow");
      expect(view.resizable()).toBe(false);
    }
    dispose();
  });
});
it.each(["albums", "compilations", "composers", pin] as const)(
  "resizes %s in list/grid and disables sizing in Cover Flow, including repeated choices",
  (scope) => {
    createRoot((dispose) => {
      const view = createCatalogPresentation(() => scope);
      for (const mode of ["list", "grid", "cover-flow", "grid"] as const) {
        for (let repeat = 0; repeat < 2; repeat++) {
          expect(view.select(mode)).toBe(true);
          expect(view.value()).toBe(mode);
          expect(view.resizable()).toBe(mode !== "cover-flow");
        }
      }
      dispose();
    });
  },
);
it("restores each catalog and pinned menu without adopting another view's presentation", () => {
  createRoot((dispose) => {
    const [scope, setScope] = createSignal<FilterScope>("albums");
    const view = createCatalogPresentation(scope);
    view.select("list");
    setScope("compilations");
    view.select("cover-flow");
    setScope(pin);
    view.select("grid");
    setScope("albums");
    expect(view.value()).toBe("list");
    setScope("compilations");
    expect(view.value()).toBe("cover-flow");
    setScope(pin);
    expect(view.value()).toBe("grid");
    dispose();
  });
});
it("refuses unsupported Cover Flow without changing a two-mode list or its size availability", () => {
  createRoot((dispose) => {
    const view = createCatalogPresentation(() => "genres");
    expect(supportsCoverFlow("genres")).toBe(false);
    expect(supportsCoverFlow("compilations")).toBe(true);
    expect(supportsCoverFlow(pin)).toBe(true);
    view.select("list");
    expect(view.select("cover-flow")).toBe(false);
    expect(view.value()).toBe("list");
    expect(view.resizable()).toBe(true);
    view.select("grid");
    expect(view.resizable()).toBe(true);
    dispose();
  });
});

it("keeps Genres cover sizing active when switching between compact lists and grids", () => {
  createRoot((dispose) => {
    const [scope, setScope] = createSignal<FilterScope>("genres");
    const view = createCatalogPresentation(scope);
    for (const mode of ["list", "grid", "list"] as const) {
      view.select(mode);
      expect(view.resizable()).toBe(true);
    }
    setScope("albums");
    expect(view.resizable()).toBe(false);
    setScope("genres");
    expect(view.value()).toBe("list");
    expect(view.resizable()).toBe(true);
    dispose();
  });
});
