import { expect, it } from "vitest";
import { parseRoute, artistCatalog, navigationLabel } from "./routes";

it("opens stable references and refuses unknown or malformed URLs", () => {
  expect(parseRoute("#/artist/artist%3Astable")).toEqual({
    kind: "artist",
    reference: "artist:stable",
  });
  expect(parseRoute("#/tags")).toEqual({ kind: "section", section: "tags" });
  expect(parseRoute("#/unexpected")).toEqual({ kind: "not-found" });
  expect(parseRoute("#/artist/%XX")).toEqual({ kind: "not-found" });
  expect(parseRoute("")).toEqual({ kind: "section", section: "artists" });
});

it("reserves an empty advanced-search workspace outside sidebar menus", () => {
  expect(parseRoute("#/advanced-search")).toEqual({ kind: "section", section: "advanced-search" });
});

it("opens provider configuration in the external-services settings tab", () => {
  expect(parseRoute("#/settings/services")).toEqual({
    kind: "section",
    section: "settings",
    tab: "services",
  });
  expect(parseRoute("#/settings/not-a-tab").kind).toBe("not-found");
});

it("uses album names and album counts for Genres while retaining artist-based Countries", () => {
  expect(artistCatalog("genres")).toBe(false);
  expect(artistCatalog("albums")).toBe(false);
  expect(artistCatalog("artists")).toBe(true);
  expect(artistCatalog("countries")).toBe(true);
});

it("names playback and utility origins without sending detail returns to a catalog fallback", () => {
  const menu = (section: string) => `Custom ${section}`;
  expect(navigationLabel(parseRoute("#/playback"), menu, () => undefined)).toBe("Lecture");
  expect(navigationLabel(parseRoute("#/settings/services"), menu, () => undefined)).toBe(
    "Paramètres",
  );
  expect(navigationLabel(parseRoute("#/advanced-search"), menu, () => undefined)).toBe(
    "Recherche avancée",
  );
  expect(navigationLabel(parseRoute("#/genres"), menu, () => undefined)).toBe("Custom genres");
});

it("keeps resolved detail names literal and supplies an honest unknown-detail label", () => {
  const route = parseRoute("#/track/track%3Anacre");
  expect(
    navigationLabel(
      route,
      () => "Catalogue",
      () => "Untranslated title",
    ),
  ).toBe("Untranslated title");
  expect(
    navigationLabel(
      route,
      () => "Catalogue",
      () => undefined,
    ),
  ).toBe("Piste");
});
