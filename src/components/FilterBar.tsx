import { For, Show } from "solid-js";
import type { Filters, Interval } from "../library/types";
import { toggleRail, type CountBin } from "../library/distribution";
import { Icon } from "./Icon";
import { RangeRail } from "./RangeRail";

const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Visible rails are explicit modes, rather than hidden active filters. */
export function FilterBar(props: {
  yearDomain: Interval;
  value: Filters;
  setValue: (value: Filters) => void;
  context: string;
  histogram: { years: CountBin[]; alphabet: CountBin[] };
  countLabel: string;
  hasUnknownYear: boolean;
}) {
  const update = (patch: Partial<Filters>) => props.setValue({ ...props.value, ...patch });
  const interval = (kind: "years" | "alphabet", value: Interval) => update({ [kind]: value });
  return (
    <div class="filters">
      <div class="filter-options">
        <div class="rail-switches" role="group" aria-label="Réglettes visibles">
          <button
            class="icon-button"
            title="Réglette des années"
            aria-label="Réglette des années"
            aria-pressed={["years", "both"].includes(props.value.mode)}
            onClick={() => update({ mode: toggleRail(props.value.mode, "years") })}
          >
            <Icon name="calendar" />
          </button>
          <button
            class="icon-button"
            title="Réglette alphabétique"
            aria-label="Réglette alphabétique"
            aria-pressed={["alphabet", "both"].includes(props.value.mode)}
            onClick={() => update({ mode: toggleRail(props.value.mode, "alphabet") })}
          >
            <Icon name="alphabet" />
          </button>
        </div>
        <span class="filter-context">{props.context}</span>
        <For each={props.value.countries ?? []}>
          {(country) => (
            <button
              class="facet"
              onClick={() =>
                update({
                  countries: props.value.countries?.filter((value) => value !== country) ?? [],
                })
              }
            >
              {country ?? "Origine inconnue"} ×
            </button>
          )}
        </For>
        <Show when={props.value.genre}>
          <button class="facet" onClick={() => update({ genre: undefined })}>
            {props.value.genre} ×
          </button>
        </Show>
        <Show when={["years", "both"].includes(props.value.mode) && props.hasUnknownYear}>
          <label title="Inclure les albums dont l’année de sortie n’est pas renseignée.">
            <input
              type="checkbox"
              checked={props.value.includeUnknownYear}
              onChange={(e) => update({ includeUnknownYear: e.currentTarget.checked })}
            />
            Inclure les dates inconnues
          </label>
        </Show>
        <button
          type="button"
          class="quiet"
          onClick={() =>
            update({
              years: props.yearDomain,
              alphabet: [0, 26],
              includeUnknownYear: true,
              query: "",
              countries: [],
              genre: undefined,
            })
          }
        >
          Tout afficher
        </button>
      </div>
      <Show when={["years", "both"].includes(props.value.mode)}>
        <RangeRail
          label="Années"
          domain={props.yearDomain}
          value={props.value.years}
          ticks={[
            ...new Set(
              Array.from({ length: 6 }, (_, index) =>
                Math.round(
                  props.yearDomain[0] + ((props.yearDomain[1] - props.yearDomain[0]) * index) / 5,
                ),
              ),
            ),
          ]}
          format={String}
          bins={props.histogram.years}
          countLabel={props.countLabel}
          onChange={(value) => interval("years", value)}
        />
      </Show>
      <Show when={["alphabet", "both"].includes(props.value.mode)}>
        <RangeRail
          label="Alphabet"
          domain={[0, 26]}
          value={props.value.alphabet}
          ticks={Array.from({ length: 27 }, (_, i) => i)}
          format={(i) => letters[i] ?? "#"}
          bins={props.histogram.alphabet}
          countLabel={props.countLabel}
          onChange={(value) => interval("alphabet", value)}
        />
      </Show>
    </div>
  );
}
