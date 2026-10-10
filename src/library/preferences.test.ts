import { describe, it, expect } from "vitest";
import { readPreferences, defaultPreferences } from "./preferences";
describe("appearance persistence", () => {
  it("uses original colours only when no preferences were saved", () => {
    expect(readPreferences({ getItem: () => null })).toEqual(defaultPreferences);
  });
  it("retains language and all validated colours", () => {
    const value = { ...defaultPreferences, language: "en", accent: "#123456" };
    expect(readPreferences({ getItem: () => JSON.stringify(value) })).toEqual(value);
  });
  it("refuses malformed preferences instead of silently replacing them", () => {
    expect(() => readPreferences({ getItem: () => '{"language":"de"}' })).toThrow();
    expect(() => readPreferences({ getItem: () => "broken" })).toThrow();
  });
});

it("upgrades the previous three-colour document and refuses invalid added colours", () => {
  const old = { language: "en", background: "#111213", accent: "#d8f36a", surface: "#1a1c1d" };
  expect(readPreferences({ getItem: () => JSON.stringify(old) })).toEqual({
    ...defaultPreferences,
    language: "en",
  });
  expect(() =>
    readPreferences({ getItem: () => JSON.stringify({ ...old, border: "not-a-colour" }) }),
  ).toThrow();
});

it("preserves dark text when migrating the previous light background", () => {
  const old = { language: "fr", background: "#ffffff", accent: "#d8f36a", surface: "#eeeeee" };
  expect(readPreferences({ getItem: () => JSON.stringify(old) }).text).toBe("#17191a");
});
