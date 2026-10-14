import type { Artist, Filters } from "./types";
const regions = new Intl.DisplayNames(["en"], { type: "region" });
/** Statistics labels are Aède's canonical country names and decade start years; other labels stay unlinked. */
export function statisticsSelection(
  kind: "country" | "decade",
  label: string,
  artists: readonly Artist[] = [],
): { section: "countries" | "albums"; filters: Partial<Filters> } | undefined {
  if (kind === "country") {
    if (!label.trim()) return undefined;
    const countries = [
      ...new Set(
        artists
          .filter(
            (artist) =>
              artist.originArea === label ||
              artist.country === label ||
              (artist.countryCode && regions.of(artist.countryCode) === label),
          )
          .map((artist) => artist.country)
          .filter((country): country is string => country !== null),
      ),
    ];
    return {
      section: "countries",
      filters: { mode: "none", countries: countries.length ? countries : [label] },
    };
  }
  if (!/^\d{1,5}$/.test(label)) return undefined;
  const start = Number(label);
  if (start % 10 !== 0 || start > 65530) return undefined;
  return {
    section: "albums",
    filters: { mode: "years", years: [start, start + 9], includeUnknownYear: false },
  };
}
