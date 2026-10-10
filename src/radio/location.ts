import { t } from "../i18n";
/** Use only an explicit system region; language alone is not location evidence. */
export function systemRadioCountry(languages: readonly string[]): string {
  for (const language of languages)
    try {
      const region = new Intl.Locale(language).region;
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    } catch {
      /* Invalid OS locale entries do not establish a country. */
    }
  return "";
}
export const radioCountryKey = "phemios.radio-country.v1";
/** User choice wins over the OS region, including an explicit all-countries blank. */
export function radioCountryPreference(
  storage: Pick<Storage, "getItem">,
  languages: readonly string[],
): string {
  const raw = storage.getItem(radioCountryKey);
  if (raw === null) return systemRadioCountry(languages);
  if (raw.length > 1024) throw new Error(t("Préférence de pays radio illisible."));
  const country: unknown = JSON.parse(raw);
  if (typeof country !== "string" || country.length > 256)
    throw new Error(t("Préférence de pays radio illisible."));
  return country;
}

/** Returning home discards station text filters but preserves the transport preference. */
export function resetRadioCriteria(languages: readonly string[], secureOnly: boolean) {
  return { country: systemRadioCountry(languages), name: "", tag: "", secureOnly };
}
