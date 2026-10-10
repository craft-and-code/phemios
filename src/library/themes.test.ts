import { expect, it } from "vitest";
import { readTheme, writeTheme } from "./themes";
import { defaultPreferences } from "./preferences";
it("exports and imports colours without changing language or carrying account data", () => {
  const original = { ...defaultPreferences, accent: "#abcdef" };
  const raw = writeTheme("Night", original);
  expect(raw).not.toContain("language");
  expect(readTheme(raw, "en")).toEqual({ ...original, language: "en" });
  const invalid = JSON.parse(raw);
  invalid.colors.password = "secret";
  expect(() => readTheme(JSON.stringify(invalid), "fr")).toThrow();
  invalid.colors.accent = "url(https://example.org/)";
  expect(() => readTheme(JSON.stringify(invalid), "fr")).toThrow();
  expect(() => readTheme('{"version":2}', "fr")).toThrow();
});
