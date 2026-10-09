import { For } from "solid-js";
import { t } from "../i18n";
import { nextStarSelection } from "../library/star-selection";
import { Icon } from "./Icon";
/** Shared compact rating glyphs; the floor preserves a nonempty minimum filter. */
export function StarRating(props: {
  value: number | null;
  label: string;
  onChange: (value: number | null) => void;
  floor?: number;
}) {
  return (
    <div class="stars" role="group" aria-label={props.label}>
      <For each={[1, 2, 3, 4, 5]}>
        {(value) => (
          <button
            type="button"
            aria-label={t("{0} étoile(s)", value)}
            aria-pressed={props.value === value}
            classList={{ selected: value <= (props.value ?? 0) }}
            onClick={() => props.onChange(nextStarSelection(props.value, value, props.floor))}
          >
            <Icon name="star" />
          </button>
        )}
      </For>
    </div>
  );
}
