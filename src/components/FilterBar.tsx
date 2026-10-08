import { Show } from "solid-js";
import type { Filters, Interval } from "../library/types";
import { toggleRail, type CountBin } from "../library/distribution";
import { Icon } from "./Icon";
import { RangeRail } from "./RangeRail";

const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Years/alphabet/both are explicit modes, rather than hidden active filters. */
export function FilterBar(props: {
  yearDomain: Interval;
  value: Filters;
  setValue: (value: Filters) => void;
  context: string;
  histogram: { years: CountBin[]; alphabet: CountBin[] };
  countLabel: string;
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
            aria-pressed={props.value.mode !== "alphabet"}
            onClick={() => update({ mode: toggleRail(props.value.mode, "years") })}
          >
            <Icon name="calendar" />
          </button>
          <button
            class="icon-button"
            title="Réglette alphabétique"
            aria-label="Réglette alphabétique"
            aria-pressed={props.value.mode !== "years"}
            onClick={() => update({ mode: toggleRail(props.value.mode, "alphabet") })}
          >
            <Icon name="alphabet" />
          </button>
        </div>
        <span class="filter-context">{props.context}</span>
        <Show when={props.value.country !== undefined}>
          <button class="facet" onClick={() => update({ country: undefined })}>
            {props.value.country ?? "Origine inconnue"} ×
          </button>
        </Show>
        <Show when={props.value.genre}>
          <button class="facet" onClick={() => update({ genre: undefined })}>
            {props.value.genre} ×
          </button>
        </Show>
        <Show when={props.value.mode !== "alphabet"}>
          <label>
            <input
              type="checkbox"
              checked={props.value.includeUnknownYear}
              onChange={(e) => update({ includeUnknownYear: e.currentTarget.checked })}
            />
            Sans année
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
              country: undefined,
              genre: undefined,
            })
          }
        >
          Tout afficher
        </button>
      </div>
      <Show when={props.value.mode !== "alphabet"}>
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
      <Show when={props.value.mode !== "years"}>
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
