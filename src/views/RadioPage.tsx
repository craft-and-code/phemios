import { RadioWave } from "../components/RadioWave";
import { radioBrowseSession } from "../radio/browse-session";
import { createRadioTuner, radioTuningKey } from "../radio/tuner";
import { createRadioTuningSound } from "../radio/tuning-sound";
import { createRadioTuningAudio } from "../radio/tuning-audio";
import { Feedback } from "../components/Feedback";
import { CountryGlobe } from "../components/CountryGlobe";
import { createDirectoryCount } from "../radio/directory-count";
import { createDirectorySearch } from "../radio/directory-search";
import {
  systemRadioCountry,
  radioCountryPreference,
  radioCountryKey,
  resetRadioCriteria,
} from "../radio/location";
import { EmptyState } from "../components/EmptyState";
import { RadioSearch } from "../components/RadioSearch";
import { RadioFavourites } from "../components/RadioFavourites";
import { createAccountRadioFavourites, radioFavouriteOwner } from "../radio/account-favourites";
import { readRadioFavourites } from "../radio/favourites";
import { locale } from "../i18n";
import { t, countryName } from "../i18n";
import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { Icon } from "../components/Icon";
import { useLibrary } from "../library/context";
import { isNative, radioStatistics, searchRadio, requestAede } from "../platform/desktop";

/** An Internet-station dial indexes the current directory page, without inventing FM frequencies. */
export function RadioPage(props: { query: string }) {
  const library = useLibrary(),
    radio = library.radio;
  const retained = radioBrowseSession.read();
  const favourites = createAccountRadioFavourites(
    () => radioFavouriteOwner(library.source(), library.session()),
    (owner, method, body) =>
      requestAede(
        "/api/me/v1/preferences",
        {},
        method,
        body ?? null,
        owner.startsWith("local|") ? "local" : "server",
      ),
  );
  const legacy = () => {
    try {
      return readRadioFavourites(localStorage);
    } catch {
      return [];
    }
  };
  const writable = () =>
    favourites.available() && library.session()?.account.role !== "auditor" && !favourites.busy();
  const [name, setName] = createSignal(retained?.draft.name ?? props.query),
    [country, setCountry] = createSignal(retained?.draft.country ?? ""),
    [tag, setTag] = createSignal(retained?.draft.tag ?? "");
  const [secureOnly, setSecureOnly] = createSignal(retained?.draft.secureOnly ?? true);
  const [preferenceError, setPreferenceError] = createSignal("");
  const counter = createDirectoryCount(radioStatistics),
    count = counter.value,
    countError = counter.error;
  const directory = createDirectorySearch(
    () => ({ name: name(), country: country(), tag: tag(), secureOnly: secureOnly() }),
    (criteria, page) =>
      searchRadio(criteria.name, criteria.country, criteria.tag, page, criteria.secureOnly),
    counter.refresh,
    (country) => {
      try {
        localStorage.setItem(radioCountryKey, JSON.stringify(country));
        setPreferenceError("");
      } catch (failure) {
        setPreferenceError(String(failure));
      }
    },
    retained?.directory,
  );
  const { stations, more, offset, selected, busy, error, loaded, search, setSelected } = directory;
  const chosen = () => stations()[selected()];
  const tuner = createRadioTuner({
    stations,
    selected,
    select: setSelected,
    station: radio.station,
    status: radio.status,
    revision: radio.revision,
    pause: radio.pause,
    cancelled: () => tuningSound.finish(),
    start: radio.start,
  });
  const tuningVolume = () =>
    library.podcast.episode()
      ? library.podcast.volume()
      : radio.station()
        ? radio.volume()
        : library.player.state().volume;
  const tuningAudio = createRadioTuningAudio();
  const tuningSound = createRadioTuningSound({
    audio: tuningAudio,
    preset: "whistle",
    volume: tuningVolume,
    error: () => setPreferenceError(t("Le son de réglage radio n’est pas disponible.")),
  });
  let tuningPointer: number | undefined;
  const moveSound = (event: PointerEvent) => {
    if (tuningSound.move({ id: event.pointerId, x: event.clientX })) tuner.interrupt();
  };
  const releaseSound = (event: PointerEvent) => {
    if (tuningPointer !== event.pointerId) return;
    tuningPointer = undefined;
    tuningSound.finish(event.pointerId);
    tuner.finish();
  };
  const cancelPointer = (event: PointerEvent) => {
    if (tuningPointer === event.pointerId) cancelTuning();
  };
  const cancelTuning = () => {
    tuningPointer = undefined;
    tuningSound.finish();
    tuner.cancel();
  };
  const hideTuning = () => {
    if (document.hidden) cancelTuning();
  };
  createEffect(() => tuningSound.volume(tuningVolume()));
  createEffect(() => {
    const playing = radio.station(),
      rows = stations();
    if (!playing) return;
    const index = rows.findIndex((station) => station.uuid === playing.uuid);
    if (index >= 0) setSelected(index);
  });
  onCleanup(() =>
    radioBrowseSession.remember(
      { name: name(), country: country(), tag: tag(), secureOnly: secureOnly() },
      directory.snapshot(),
    ),
  );
  createEffect(() => {
    stations();
    tuningSound.finish();
  });
  onCleanup(tuningSound.dispose);
  onMount(() => {
    window.addEventListener("pointermove", moveSound);
    window.addEventListener("pointerup", releaseSound);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("blur", cancelTuning);
    document.addEventListener("visibilitychange", hideTuning);
    onCleanup(() => {
      window.removeEventListener("pointermove", moveSound);
      window.removeEventListener("pointerup", releaseSound);
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("blur", cancelTuning);
      document.removeEventListener("visibilitychange", hideTuning);
    });
    if (retained) return;
    try {
      setCountry(radioCountryPreference(localStorage, navigator.languages));
    } catch (failure) {
      setCountry(systemRadioCountry(navigator.languages));
      setPreferenceError(String(failure));
    }
    if (isNative()) void search(0, true, false);
  });
  return (
    <section class="page radio-page radio-explorer">
      <aside class="radio-world">
        <CountryGlobe
          artists={[]}
          directory
          selected={country() ? [country()] : []}
          focus={country()}
          onReset={() => {
            const home = resetRadioCriteria(navigator.languages, secureOnly());
            setCountry(home.country);
            setName(home.name);
            setTag(home.tag);
            directory.clear();
            if (isNative()) void search(0, true);
            return home.country;
          }}
          onSelect={(value) => {
            setCountry(value ?? "");
            if (isNative()) void search(0, true);
          }}
        />
      </aside>
      <div class="radio-results">
        <p class="intro">{t("Explorez les radios Internet du monde entier.")}</p>
        <RadioSearch
          value={{ name: name(), country: country(), tag: tag(), secureOnly: secureOnly() }}
          change={(value) => {
            if (value.name !== undefined) setName(value.name);
            if (value.country !== undefined) setCountry(value.country);
            if (value.tag !== undefined) setTag(value.tag);
            if (value.secureOnly !== undefined) setSecureOnly(value.secureOnly);
          }}
          submit={() => void search(0, true)}
          busy={busy()}
          available={isNative()}
        />
        <Show when={library.session()}>
          <RadioFavourites
            favourites={favourites}
            play={(station) => void radio.start(station)}
            busy={radio.status() === "connecting"}
            writable={writable()}
          />
        </Show>
        <Show when={writable() && !favourites.stations().length && legacy().length}>
          <button onClick={() => void favourites.importDevice(legacy())}>
            {t("Importer les radios favorites de cet appareil")}
          </button>
        </Show>

        <Show when={!isNative()}>
          <p class="notice">
            {t("L’annuaire et l’écoute Internet sont disponibles dans l’application desktop.")}{" "}
          </p>
        </Show>
        <Show when={preferenceError()}>
          <Feedback error message={preferenceError()} onClose={() => setPreferenceError("")} />
        </Show>
        <Show when={error()}>
          <Feedback error message={error()} onClose={directory.clearError} />
        </Show>
        <Show when={count()}>
          <p class="muted">
            {count()!.toLocaleString(locale())}{" "}
            {t(
              "entrées dans Radio Browser · recherche dans l’annuaire complet · affichage par 50.",
            )}{" "}
          </p>
        </Show>
        <Show when={countError()}>
          <small>{countError()}</small>
        </Show>
        <Show when={stations().length}>
          <div class="radio-tuner">
            <div class="radio-display">
              <Icon name="radio" />
              <div>
                <small>
                  {t("RADIO INTERNET · STATION")}{" "}
                  {String(offset() + selected() + 1).padStart(2, "0")}
                </small>
                <strong>{chosen()?.name}</strong>
                <span>
                  {countryName(chosen()?.countryCode, chosen()?.country ?? null)} ·{" "}
                  {chosen()?.codec || t("Format inconnu")}
                  {chosen()?.bitrate ? ` · ${chosen()?.bitrate} kbit/s` : ""}
                </span>
              </div>
              <Show when={chosen()}>
                {(station) => (
                  <button
                    type="button"
                    class="icon-button quiet radio-favourite"
                    aria-label={
                      favourites.has(station().uuid)
                        ? t("Retirer {0} des radios favorites", station().name)
                        : t("Ajouter {0} aux radios favorites", station().name)
                    }
                    aria-pressed={favourites.has(station().uuid)}
                    disabled={!writable()}
                    onClick={() => void favourites.toggle(station())}
                  >
                    <Icon name="heart" />
                  </button>
                )}
              </Show>
              <button
                class="play-button"
                aria-label={t("Écouter la station sélectionnée")}
                disabled={busy() || radio.status() === "connecting"}
                onClick={() => {
                  const station = chosen();
                  if (station) void radio.start(station);
                }}
              >
                <Icon name="play" />
              </button>
            </div>
            <div class="radio-dial">
              <svg class="radio-scale" viewBox="0 0 900 120" aria-hidden="true">
                <RadioWave
                  sample={(target) => tuningAudio.sample?.(target) || radio.sample(target)}
                />
                <For each={Array.from({ length: stations().length }, (_, i) => i)}>
                  {(i) => {
                    const x = () => 20 + (i / Math.max(1, stations().length - 1)) * 860;
                    return (
                      <g>
                        <line x1={x()} x2={x()} y1={i % 5 === 0 ? 40 : 54} y2="90" />
                        <Show when={i % 5 === 0}>
                          <text x={x()} y="110" text-anchor="middle">
                            {String(offset() + i + 1).padStart(2, "0")}
                          </text>
                        </Show>
                      </g>
                    );
                  }}
                </For>
                <line
                  class="radio-needle"
                  x1={20 + (selected() / Math.max(1, stations().length - 1)) * 860}
                  x2={20 + (selected() / Math.max(1, stations().length - 1)) * 860}
                  y1="10"
                  y2="92"
                />
              </svg>
              <input
                class="radio-dial-input"
                type="range"
                min="0"
                max={stations().length - 1}
                step="1"
                value={selected()}
                aria-label={t("Sélectionner une station sur le cadran")}
                aria-valuetext={chosen()?.name ?? ""}
                onPointerDown={(event) => {
                  if (event.button !== 0 || !event.isPrimary) return;
                  tuningPointer = event.pointerId;
                  tuner.begin();
                  if (stations().length > 1)
                    tuningSound.begin({ id: event.pointerId, x: event.clientX });
                }}
                onInput={(e) => tuner.preview(Number(e.currentTarget.value))}
                onChange={() => tuner.change()}
                onPointerUp={releaseSound}
                onPointerCancel={cancelPointer}
                onLostPointerCapture={cancelPointer}
                onKeyDown={(event) => {
                  if (radioTuningKey(event.key)) tuner.begin();
                }}
                onKeyUp={(event) => {
                  if (radioTuningKey(event.key)) tuner.finish();
                }}
                onBlur={cancelTuning}
              />
            </div>
            <p class="muted">
              {t(
                "Glissez le cadran : l’écoute démarre sur la station choisie quand vous relâchez. Un clic sur une station lance aussi l’écoute.",
              )}{" "}
            </p>
          </div>
          <ul class="radio-stations">
            <For each={stations()}>
              {(station, i) => (
                <li classList={{ selected: selected() === i() }}>
                  <button
                    class="radio-station"
                    aria-pressed={selected() === i()}
                    onClick={() => tuner.choose(i())}
                  >
                    <span class="radio-station-number">
                      {String(offset() + i() + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{station.name}</strong>
                      <small>
                        {countryName(station.countryCode, station.country)} ·{" "}
                        {station.tags || t("Style non renseigné")}
                      </small>
                    </span>
                    <small>
                      {station.codec}
                      {station.bitrate ? ` · ${station.bitrate}k` : ""}
                    </small>
                  </button>
                  <button
                    type="button"
                    class="icon-button quiet radio-favourite"
                    aria-label={
                      favourites.has(station.uuid)
                        ? t("Retirer {0} des radios favorites", station.name)
                        : t("Ajouter {0} aux radios favorites", station.name)
                    }
                    aria-pressed={favourites.has(station.uuid)}
                    disabled={!writable()}
                    onClick={() => void favourites.toggle(station)}
                  >
                    <Icon name="heart" />
                  </button>
                </li>
              )}
            </For>
          </ul>
          <div class="page-heading">
            <button
              disabled={busy() || offset() === 0}
              onClick={() => void search(Math.max(0, offset() - 50))}
            >
              {t("Précédentes")}{" "}
            </button>
            <span>
              {t("Stations")} {offset() + 1}–{offset() + stations().length}
            </span>
            <button disabled={busy() || !more()} onClick={() => void search(offset() + 50)}>
              {t("Suivantes")}{" "}
            </button>
          </div>
        </Show>
        <Show when={loaded() && !stations().length && !busy()}>
          <EmptyState icon="radio">{t("Aucune station pour ces critères.")}</EmptyState>
        </Show>
        <p class="radio-credit">
          {t("Annuaire communautaire")}{" "}
          <a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">
            {t("Radio Browser")}{" "}
          </a>
          {t(
            ". Chaque entrée décrit un flux ; certaines stations ont plusieurs flux. L’écoute utilise les codecs et la sortie système du navigateur intégré.",
          )}{" "}
        </p>
      </div>
    </section>
  );
}
