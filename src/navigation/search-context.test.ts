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
    "radio",
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
