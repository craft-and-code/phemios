import { For, Show } from "solid-js";
import { t, countryName } from "../i18n";
import { Icon } from "./Icon";
import type { Station } from "../radio/directory";
import type { createAccountRadioFavourites } from "../radio/account-favourites";
/** Saved stations play by UUID without searching the directory first. */
export function RadioFavourites(props: {
  favourites: Pick<
    ReturnType<typeof createAccountRadioFavourites>,
    "error" | "stations" | "toggle"
  >;
  play: (station: Station) => void;
  busy: boolean;
  writable: boolean;
}) {
  return (
    <section class="radio-favourites">
      <h2>{t("Radios favorites")}</h2>
      <Show when={props.favourites.error()}>
        <p role="alert">{props.favourites.error()}</p>
      </Show>
      <Show
        when={props.favourites.stations().length}
        fallback={<p class="muted">{t("Utilisez le cœur d’une station pour la retrouver ici.")}</p>}
      >
        <ul class="radio-stations">
          <For each={props.favourites.stations()}>
            {(station) => (
              <li>
                <button
                  type="button"
                  class="radio-station"
                  disabled={props.busy}
                  onClick={() => props.play(station)}
                  aria-label={t("Écouter {0}", station.name)}
                >
                  <Icon name="play" />
                  <span>
                    <strong>{station.name}</strong>
                    <small>{countryName(station.countryCode, station.country)}</small>
                  </span>
                </button>
                <button
                  type="button"
                  class="icon-button quiet radio-favourite"
                  aria-pressed="true"
                  aria-label={t("Retirer {0} des radios favorites", station.name)}
                  disabled={!props.writable}
                  onClick={() => void props.favourites.toggle(station)}
                >
                  <Icon name="heart" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
