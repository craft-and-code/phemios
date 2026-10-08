import { Show } from "solid-js";
import type { Filters, Interval, RailMode } from "../library/types";
import { RangeRail } from "./RangeRail";

const letters = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Years/alphabet/both are explicit modes, rather than hidden active filters. */
export function FilterBar(props: {
  yearDomain: Interval;
  value: Filters;
  setValue: (value: Filters) => void;
  context: string;
}) {
  const update = (patch: Partial<Filters>) => props.setValue({ ...props.value, ...patch });
  const interval = (kind: "years" | "alphabet", value: Interval) => update({ [kind]: value });
  return (
    <div class="filters">
      <div class="filter-options">
        <label>
          Réglettes{" "}
          <select
            value={props.value.mode}
            onChange={(e) => update({ mode: e.currentTarget.value as RailMode })}
          >
            <option value="years">Années</option>
            <option value="alphabet">Alphabet</option>
            <option value="both">Les deux</option>
          </select>
        </label>
        <span class="filter-context">{props.context}</span>
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
          onChange={(value) => interval("alphabet", value)}
        />
      </Show>
    </div>
  );
}
