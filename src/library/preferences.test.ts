import { describe, it, expect } from "vitest";
import { readPreferences, defaultPreferences } from "./preferences";
describe("appearance persistence", () => {
  it("uses original colours only when no preferences were saved", () => {
    expect(readPreferences({ getItem: () => null })).toEqual(defaultPreferences);
  });
  it("retains language and all three validated colours", () => {
    const value = { ...defaultPreferences, language: "en", accent: "#123456" };
    expect(readPreferences({ getItem: () => JSON.stringify(value) })).toEqual(value);
  });
  it("refuses malformed preferences instead of silently replacing them", () => {
    expect(() => readPreferences({ getItem: () => '{"language":"de"}' })).toThrow();
    expect(() => readPreferences({ getItem: () => "broken" })).toThrow();
  });
});
