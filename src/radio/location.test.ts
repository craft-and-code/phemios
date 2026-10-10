import { expect, it } from "vitest";
import { systemRadioCountry, radioCountryPreference } from "./location";
it("uses an explicit system region rather than inferring a country from a language", () => {
  expect(systemRadioCountry(["fr-FR"])).toBe("FR");
  expect(systemRadioCountry(["en-GB"])).toBe("GB");
  expect(systemRadioCountry(["fr", "en"])).toBe("");
  expect(systemRadioCountry(["invalid_locale", "de-DE"])).toBe("DE");
  expect(radioCountryPreference({ getItem: () => '"Canada"' }, ["fr-FR"])).toBe("Canada");
  expect(() => radioCountryPreference({ getItem: () => "{broken" }, ["fr-FR"])).toThrow();
});
