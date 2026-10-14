import { For } from "solid-js";
import { Icon } from "./Icon";
import { t } from "../i18n";
import type { ArtistView } from "../library/tool-preferences";
const choices = [
  { id: "portrait", icon: "users", label: "Portrait immersif" },
  { id: "discography", icon: "artist-card", label: "Cartes d’artistes" },
  { id: "editorial", icon: "layers", label: "Ligne éditoriale" },
] as const;
/** Mutually selected presentations remain available; choosing one never disables its neighbours. */
export function ArtistViewActions(props: {
  value: ArtistView;
  onChange: (value: ArtistView) => void;
}) {
  return (
    <div class="artist-view-actions" role="group" aria-label={t("Présentation des artistes")}>
      <For each={choices}>
        {(choice) => (
          <button
            type="button"
            class="icon-button"
            aria-pressed={props.value === choice.id}
            aria-label={t(choice.label)}
            title={t(choice.label)}
            onClick={() => props.onChange(choice.id)}
          >
            <Icon name={choice.icon} />
          </button>
        )}
      </For>
    </div>
  );
}
