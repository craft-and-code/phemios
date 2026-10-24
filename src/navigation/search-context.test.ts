import { afterEach, expect, it } from "vitest";
import { changeLanguage } from "../i18n";
import { searchContext } from "./search-context";
afterEach(() => changeLanguage("fr"));
it("scopes search wording only to Your music and keeps the catalogue wording elsewhere", () => {
  for (const scope of [
    "moods",
    "favourites",
    "rated",
    "tags",
    "collections",
    "history",
    "playlists",
  ] as const)
    expect(searchContext(scope).contextual).toBe(true);
  expect(searchContext("tags").placeholder).toBe("Rechercher un tag");
  for (const scope of [
    "artists",
    "albums",
    "tracks",
    "compilations",
    "countries",
    "genres",
    "labels",
    "settings",
    undefined,
  ] as const) {
    expect(searchContext(scope).contextual).toBe(false);
    expect(searchContext(scope).label).toBe("Rechercher dans tous les champs du catalogue");
  }
  changeLanguage("en");
  expect(searchContext("tags").placeholder).toBe("Search tags");
  expect(searchContext("favourites").placeholder).toBe("Search favourites");
});

it.each([
  "playback",
  "radio",
  "podcasts",
  "cd",
  "concerts",
  "players",
  "doctor",
  "statistics",
  "achievements",
] as const)("disables unused header search in %s", (section) => {
  expect(searchContext(section).disabled).toBe(true);
  expect(searchContext(section).placeholder).toBe("Recherche indisponible dans cette vue");
});
it.each([
  ["relations", "Rechercher un artiste dans les relations"],
  ["encyclopedia", "Rechercher un article"],
  ["analysis", "Rechercher dans les analyses"],
] as const)("advertises the actual search scope in %s", (section, placeholder) => {
  expect(searchContext(section)).toMatchObject({
    disabled: false,
    contextual: true,
    label: placeholder,
    placeholder,
  });
});
it("keeps catalogue search available when returning from a disabled source", () => {
  expect(searchContext("radio").disabled).toBe(true);
  expect(searchContext("albums").disabled).toBe(false);
  changeLanguage("en");
  expect(searchContext("players").placeholder).toBe("Search unavailable in this view");
  expect(searchContext("analysis").placeholder).toBe("Search analyses");
});
