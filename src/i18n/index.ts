import { createSignal } from "solid-js";
import english from "./en.json";
export type Language = "fr" | "en";
const [language, setLanguage] = createSignal<Language>("fr");
/** Current presentation language; account and catalog identities remain untouched. */
export const locale = language;
/** Apply only supported locales; no reload or playback interruption is needed. */
export function changeLanguage(value: Language) {
  setLanguage(value);
  if (typeof document !== "undefined") document.documentElement.lang = value;
}
const dictionary: Readonly<Record<string, string>> = english;
const originals = new Map(Object.entries(dictionary).map(([fr, en]) => [en, fr]));
/** Exact message lookup and placeholder replacement never translate inserted user data. */
export function translate(value: Language, message: string, ...parameters: unknown[]): string {
  const canonical = Object.hasOwn(dictionary, message)
    ? message
    : (originals.get(message) ?? message);
  const template = value === "en" ? (dictionary[canonical] ?? message) : canonical;
  return template.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
    Number(index) < parameters.length ? String(parameters[Number(index)]) : placeholder,
  );
}
/** Use in reactive rendering and controls, never on catalog titles, tags or notes. */
export function t(message: string, ...parameters: unknown[]): string {
  return translate(language(), message, ...parameters);
}
/** Display a country label without changing the canonical filter value. */
export function countryName(code: string | undefined, fallback: string | null): string {
  if (code && /^[A-Z]{2}$/.test(code))
    try {
      return new Intl.DisplayNames([language()], { type: "region" }).of(code) ?? fallback ?? code;
    } catch {
      /* Unknown codes keep their retained label. */
    }
  return fallback ?? t("Origine inconnue");
}
