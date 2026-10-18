import { translate, type Language } from "../i18n";
/** Shared standalone album count; exactly one uses the singular, including in French. */
export function albumCount(value: number, language: Language): string {
  return translate(
    language,
    value === 1 ? "{0} album" : "{0} albums",
    value.toLocaleString(language),
  );
}
