import { createSignal, type Accessor } from "solid-js";
import { t, countryName } from "../i18n";
import { selectedGenres } from "../library/filtering";
import type { Filters, Interval } from "../library/types";
import type { Section } from "./routes";
/** Filters belong to their view and exact account/source generation, never a successor login. */
export function createScopedFilters(
  section: Accessor<Section>,
  domain: Accessor<Interval>,
  identity: Accessor<unknown> = () => undefined,
) {
  const [saved, setSaved] = createSignal<
    Partial<Record<Section, { value: Filters; domain: Interval; identity: unknown }>>
  >({});
  const defaults = (scope: Section): Filters => ({
    mode: ["countries", "artists", "albums", "composers"].includes(scope) ? "none" : "years",
    years: domain(),
    alphabet: [0, 26],
    includeUnknownYear: true,
    query: "",
  });
  function read(scope: Section): Filters {
    const held = saved()[scope];
    if (!held || held.identity !== identity()) return defaults(scope);
    const bounds = domain(),
      old = held.domain;
    const years: Interval =
      held.value.years[0] === old[0] && held.value.years[1] === old[1]
        ? bounds
        : [
            Math.max(bounds[0], Math.min(bounds[1], held.value.years[0])),
            Math.max(bounds[0], Math.min(bounds[1], held.value.years[1])),
          ];
    return { ...held.value, years };
  }
  return {
    value: () => read(section()),
    set: (value: Filters) =>
      setSaved((held) => ({
        ...held,
        [section()]: { value, domain: domain(), identity: identity() },
      })),
    select: (scope: Section, patch: Partial<Filters>) =>
      setSaved((held) => ({
        ...held,
        [scope]: {
          value: { ...defaults(scope), ...patch },
          domain: domain(),
          identity: identity(),
        },
      })),
  };
}
export interface ActiveFilter {
  key: string;
  label: string;
}
/** Hidden rails do not restrict results and are omitted from the visible summary. */
export function activeFilters(value: Filters, domain: Interval): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (value.recentOnly) out.push({ key: "recent", label: t("Ajoutés ces 30 derniers jours") });
  if (value.query.trim()) out.push({ key: "query", label: t("Recherche : {0}", value.query) });
  if (["years", "both"].includes(value.mode)) {
    if (value.years[0] !== domain[0] || value.years[1] !== domain[1])
      out.push({ key: "years", label: t("Années : {0}–{1}", ...value.years) });
    if (!value.includeUnknownYear)
      out.push({ key: "unknown", label: t("Dates connues uniquement") });
  }
  if (
    ["alphabet", "both"].includes(value.mode) &&
    (value.alphabet[0] !== 0 || value.alphabet[1] !== 26)
  ) {
    const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    out.push({
      key: "alphabet",
      label: t(
        "Alphabet : {0}–{1}",
        letters[value.alphabet[0]] ?? "#",
        letters[value.alphabet[1]] ?? "Z",
      ),
    });
  }
  for (const country of value.countries ?? [])
    out.push({
      key: `country:${country ?? ""}`,
      label: country === null ? t("Origine inconnue") : countryName(country, country),
    });
  for (const reference of value.composers ?? [])
    out.push({ key: `composer:${reference}`, label: t("Compositeur sélectionné") });
  for (const genre of selectedGenres(value)) out.push({ key: `genre:${genre}`, label: genre });
  return out;
}
/** Remove only the chosen restriction, retaining rail visibility and unrelated selections. */
export function clearFilter(value: Filters, key: string, domain: Interval): Filters {
  if (key.startsWith("composer:"))
    return { ...value, composers: value.composers?.filter((v) => `composer:${v}` !== key) ?? [] };
  if (key === "recent") return { ...value, recentOnly: false };
  if (key === "query") return { ...value, query: "" };
  if (key === "years") return { ...value, years: domain };
  if (key === "unknown") return { ...value, includeUnknownYear: true };
  if (key === "alphabet") return { ...value, alphabet: [0, 26] };
  if (key.startsWith("country:"))
    return {
      ...value,
      countries: value.countries?.filter((v) => `country:${v ?? ""}` !== key) ?? [],
    };
  return {
    ...value,
    genre: undefined,
    genres: selectedGenres(value).filter((v) => `genre:${v}` !== key),
  };
}
