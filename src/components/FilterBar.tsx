import { ResultCount } from "./ResultCount";
import { countRail } from "../library/result-count";
import { t } from "../i18n";
import { Show } from "solid-js";
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
  resultCount: number;
  hasUnknownYear: boolean;
}) {
  const update = (patch: Partial<Filters>) => props.setValue({ ...props.value, ...patch });
  const interval = (kind: "years" | "alphabet", value: Interval) => update({ [kind]: value });
  return (
    <div class="filters">
      <div class="filter-options">
        <div class="rail-switches" role="group" aria-label={t("Réglettes visibles")}>
          <button
            class="icon-button"
            title={t("Réglette des années")}
            aria-label={t("Réglette des années")}
            aria-pressed={["years", "both"].includes(props.value.mode)}
            onClick={() => update({ mode: toggleRail(props.value.mode, "years") })}
          >
            <Icon name="calendar" />
          </button>
          <button
            class="icon-button"
            title={t("Réglette alphabétique")}
            aria-label={t("Réglette alphabétique")}
            aria-pressed={["alphabet", "both"].includes(props.value.mode)}
            onClick={() => update({ mode: toggleRail(props.value.mode, "alphabet") })}
          >
            <Icon name="alphabet" />
          </button>
        </div>
        <Show when={props.value.mode === "none"}>
          <ResultCount value={props.resultCount} />
        </Show>
        <span class="filter-context">{props.context}</span>
        <Show when={["years", "both"].includes(props.value.mode) && props.hasUnknownYear}>
          <label title={t("Inclure les albums dont l’année de sortie n’est pas renseignée.")}>
            <input
              type="checkbox"
              checked={props.value.includeUnknownYear}
              onChange={(e) => update({ includeUnknownYear: e.currentTarget.checked })}
            />
            {t("Inclure les dates inconnues")}{" "}
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
              genres: [],
            })
          }
        >
          {t("Tout afficher")}{" "}
        </button>
      </div>
      <Show when={["years", "both"].includes(props.value.mode)}>
        <RangeRail
          label={t("Années")}
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
          resultCount={countRail(props.value.mode) === "years" ? props.resultCount : undefined}
          onChange={(value) => interval("years", value)}
        />
      </Show>
      <Show when={["alphabet", "both"].includes(props.value.mode)}>
        <RangeRail
          label={t("Alphabet")}
          domain={[0, 26]}
          value={props.value.alphabet}
          ticks={Array.from({ length: 27 }, (_, i) => i)}
          format={(i) => letters[i] ?? "#"}
          bins={props.histogram.alphabet}
          countLabel={props.countLabel}
          resultCount={countRail(props.value.mode) === "alphabet" ? props.resultCount : undefined}
          onChange={(value) => interval("alphabet", value)}
        />
      </Show>
    </div>
  );
}
