import { afterEach, expect, it } from "vitest";
import { createComputed, createRoot } from "solid-js";
import { changeLanguage, countryName, locale, t, translate } from "./index";
import english from "./en.json";
import { readPreferences, defaultPreferences } from "../library/preferences";
import { fileSize } from "../library/detail-format";
import { bytesLabel, durationLabel } from "../library/statistics";

afterEach(() => changeLanguage("fr"));

it("switches existing reactive labels and measurements without recreating their owner", () => {
  createRoot((dispose) => {
    const values: string[] = [];
    createComputed(() =>
      values.push(`${t("Artistes")}/${countryName("GB", "Royaume-Uni")}/${fileSize(32_300_000)}`),
    );
    changeLanguage("en");
    expect(locale()).toBe("en");
    expect(t("Artistes")).toBe("Artists");
    expect(countryName("GB", "Royaume-Uni")).toBe("United Kingdom");
    expect(fileSize(32_300_000)).toBe("32.3 MB");
    expect(bytesLabel(1024 ** 2)).toBe("1 MiB");
    expect(durationLabel(86_400_000)).toBe("1 d 0 h 0 min");
    changeLanguage("fr");
    expect(countryName("GB", "Royaume-Uni")).toBe("Royaume-Uni");
    expect(fileSize(32_300_000)).toBe("32,3 Mo");
    expect(values).toEqual([
      "Artistes/Royaume-Uni/32,3 Mo",
      "Artists/United Kingdom/32.3 MB",
      "Artistes/Royaume-Uni/32,3 Mo",
    ]);
    dispose();
  });
});

it("restores a supported language alongside its saved theme", () => {
  const saved = { ...defaultPreferences, language: "en" };
  changeLanguage(readPreferences({ getItem: () => JSON.stringify(saved) }).language);
  expect(t("Paramètres")).toBe("Settings");
  expect(translate("fr", t("Paramètres"))).toBe("Paramètres");
});

it("preserves exact inserted titles, notes and placeholders instead of translating user data", () => {
  const personal = "Artistes · Favoris · {1} · <b>Music</b>";
  expect(translate("en", "M3U téléchargé : {0}", personal)).toBe(`M3U downloaded: ${personal}`);
  expect(translate("fr", "M3U téléchargé : {0}", personal)).toBe(`M3U téléchargé : ${personal}`);
  expect(translate("en", "An unknown external service error")).toBe(
    "An unknown external service error",
  );
  expect(countryName(undefined, "An attributed place")).toBe("An attributed place");
});

it("preserves all translation parameters and covers each literal UI message", () => {
  const dictionary: Record<string, string> = english;
  const parameters = (s: string) => [...s.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
  for (const [original, translated] of Object.entries(dictionary)) {
    expect(translated.trim(), original).not.toBe("");
    expect(parameters(translated), original).toEqual(parameters(original));
  }
  const sources = import.meta.glob<string>(
    ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../i18n/**"],
    { query: "?raw", import: "default", eager: true },
  );
  for (const [file, source] of Object.entries(sources))
    for (const match of source.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) {
      const message: string = JSON.parse(match[1]!);
      expect(Object.hasOwn(dictionary, message), `${file}: ${message}`).toBe(true);
    }
});
