import { ChoiceChips } from "./ChoiceChips";
import { t, countryName } from "../i18n";
import type { Country } from "../geography/projection";
import type { Artist } from "../library/types";
import { CountryGlobe } from "./CountryGlobe";

/** Keep the globe and keyboard country choices independent from the changing result list. */
export function CountryExplorer(props: {
  /** Local geometry injection makes isolated presentation independent of asset serving. */
  loadCountries?: (() => Promise<readonly Country[]>) | undefined;
  artists: readonly Artist[];
  selected: readonly (string | null)[];
  onSelect: (country: string | null | undefined, additive?: boolean) => void;
}) {
  return (
    <aside class="country-exploration" aria-label={t("Exploration des pays")}>
      <CountryGlobe
        loadCountries={props.loadCountries}
        artists={props.artists}
        selected={props.selected}
        onSelect={props.onSelect}
      />
      <ChoiceChips
        label={t("Pays d’origine")}
        selected={props.selected}
        onSelect={props.onSelect}
        choices={[...new Set(props.artists.map((artist) => artist.country))].map((country) => ({
          id: country,
          label: countryName(
            props.artists.find((artist) => artist.country === country)?.countryCode,
            country,
          ),
        }))}
      />
    </aside>
  );
}
