import { For } from "solid-js";
import { t, countryName } from "../i18n";
import { additiveCountrySelection, isMac } from "../library/selection";
import type { Artist } from "../library/types";
import { CountryGlobe } from "./CountryGlobe";

/** Keep the globe and keyboard country choices independent from the changing result list. */
export function CountryExplorer(props: {
  artists: readonly Artist[];
  selected: readonly (string | null)[];
  onSelect: (country: string | null | undefined, additive?: boolean) => void;
}) {
  return (
    <aside class="country-exploration" aria-label={t("Exploration des pays")}>
      <CountryGlobe artists={props.artists} selected={props.selected} onSelect={props.onSelect} />
      <div class="choices" aria-label={t("Pays d’origine")}>
        <button aria-pressed={!props.selected.length} onClick={() => props.onSelect(undefined)}>
          {t("Tous")}
        </button>
        <For each={[...new Set(props.artists.map((artist) => artist.country))]}>
          {(country) => (
            <button
              aria-pressed={props.selected.includes(country)}
              onClick={(event) => props.onSelect(country, additiveCountrySelection(event, isMac()))}
            >
              {countryName(
                props.artists.find((artist) => artist.country === country)?.countryCode,
                country,
              )}
            </button>
          )}
        </For>
      </div>
    </aside>
  );
}
