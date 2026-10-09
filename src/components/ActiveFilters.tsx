import { For, Show } from "solid-js";
import { t } from "../i18n";
import { activeFilters, clearFilter } from "../navigation/scoped-filters";
import type { Filters, Interval } from "../library/types";
/** A persistent summary makes every restriction reviewable without reopening its rail. */
export function ActiveFilters(props: {
  value: Filters;
  domain: Interval;
  setValue: (value: Filters) => void;
  catalog: boolean;
}) {
  const visible = () =>
    props.catalog
      ? props.value
      : { ...props.value, mode: "none" as const, countries: [], genre: undefined, genres: [] };
  const rows = () => activeFilters(visible(), props.domain);
  return (
    <Show when={rows().length}>
      <div class="active-filters" role="group" aria-label={t("Filtres actifs")}>
        <strong>{t("Filtres actifs ({0})", rows().length)}</strong>
        <For each={rows()}>
          {(row) => (
            <button
              class="facet"
              title={t("Retirer {0}", row.label)}
              onClick={() => props.setValue(clearFilter(props.value, row.key, props.domain))}
            >
              {row.label} ×
            </button>
          )}
        </For>
        <button
          class="quiet"
          onClick={() =>
            props.setValue({
              ...props.value,
              years: props.domain,
              alphabet: [0, 26],
              includeUnknownYear: true,
              query: "",
              countries: [],
              genre: undefined,
              genres: [],
            })
          }
        >
          {t("Tout afficher")}
        </button>
      </div>
    </Show>
  );
}
