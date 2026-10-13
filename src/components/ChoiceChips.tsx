import { For } from "solid-js";
import { t } from "../i18n";
import { additiveCountrySelection, isMac } from "../library/selection";
import { Icon } from "./Icon";
/** Compact named selections retain native keyboard buttons and the existing modifier-selection policy. */
export function ChoiceChips(props: {
  label: string;
  choices: readonly { id: string | null; label: string }[];
  selected: readonly (string | null)[];
  onSelect: (value: string | null | undefined, additive: boolean) => void;
}) {
  return (
    <div class="choice-chips" role="group" aria-label={props.label}>
      <button
        aria-pressed={!props.selected.length}
        onClick={() => props.onSelect(undefined, false)}
      >
        {t("Tous")}
      </button>
      <For each={props.choices}>
        {(choice) => (
          <button
            aria-pressed={props.selected.includes(choice.id)}
            onClick={(event) => props.onSelect(choice.id, additiveCountrySelection(event, isMac()))}
          >
            <span class="choice-chip-marker" aria-hidden="true">
              <Icon name="check" />
            </span>
            {choice.label}
          </button>
        )}
      </For>
    </div>
  );
}
