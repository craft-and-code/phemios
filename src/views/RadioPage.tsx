import { Feedback } from "../components/Feedback";
import { CountryGlobe } from "../components/CountryGlobe";
import { createDirectoryCount } from "../radio/directory-count";
import {
  systemRadioCountry,
  radioCountryPreference,
  radioCountryKey,
  resetRadioCriteria,
} from "../radio/location";
import { EmptyState } from "../components/EmptyState";
import { RadioSearch } from "../components/RadioSearch";
import { RadioFavourites } from "../components/RadioFavourites";
import { createAccountRadioFavourites } from "../radio/account-favourites";
import { readRadioFavourites } from "../radio/favourites";
import { locale } from "../i18n";
import { t, countryName } from "../i18n";
import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { Icon } from "../components/Icon";
import { useLibrary } from "../library/context";
import { isNative, radioStatistics, searchRadio, requestAede } from "../platform/desktop";
import { parseStations, type Station } from "../radio/directory";
/** An Internet-station dial indexes the current directory page, without inventing FM frequencies. */
export function RadioPage(props: { query: string }) {
  const library = useLibrary(),
    radio = library.radio;
  const favourites = createAccountRadioFavourites(
    () => {
      const session = library.session();
      return session
        ? `${library.source()}|${session.server}|${session.account.username}`
        : undefined;
    },
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
  const [name, setName] = createSignal(props.query),
    [country, setCountry] = createSignal(""),
    [tag, setTag] = createSignal("");
  const [secureOnly, setSecureOnly] = createSignal(true);
  const [stations, setStations] = createSignal<Station[]>([]),
    [more, setMore] = createSignal(false),
    [offset, setOffset] = createSignal(0),
    [selected, setSelected] = createSignal(0),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(""),
    [loaded, setLoaded] = createSignal(false),
    [preferenceError, setPreferenceError] = createSignal("");
  const counter = createDirectoryCount(radioStatistics),
    count = counter.value,
    countError = counter.error;
  let criteria = { name: "", country: "", tag: "", secureOnly: true },
    alive = true,
    pendingSearch = false,
    searchEpoch = 0;
  // A late result may populate this page only while its owner is mounted.
  onCleanup(() => {
    alive = false;
  });
  const chosen = () => stations()[selected()];
  onMount(() => {
    try {
      setCountry(radioCountryPreference(localStorage, navigator.languages));
    } catch (failure) {
      setCountry(systemRadioCountry(navigator.languages));
      setPreferenceError(String(failure));
    }
    if (isNative()) void search(0, true, false);
  });
  async function search(page = 0, fresh = false, remember = true) {
    if (fresh) searchEpoch += 1;
    if (busy()) {
      if (fresh) pendingSearch = true;
      return;
    }
    if (fresh) {
      if (remember)
        try {
          localStorage.setItem(radioCountryKey, JSON.stringify(country()));
          setPreferenceError("");
        } catch (failure) {
          setPreferenceError(String(failure));
        }
      criteria = { name: name(), country: country(), tag: tag(), secureOnly: secureOnly() };
    }
    const epoch = searchEpoch;
    setBusy(true);
    setError("");
    try {
      const response = parseStations(
        await searchRadio(criteria.name, criteria.country, criteria.tag, page, criteria.secureOnly),
      );
      if (!alive || epoch !== searchEpoch || criteria.country !== country()) return;
      setStations(response.stations);
      setMore(response.more);
      setOffset(page);
      setSelected(0);
      setLoaded(true);
      counter.refresh();
    } catch (failure) {
      if (alive && epoch === searchEpoch)
        setError(failure instanceof Error ? failure.message : t("Annuaire radio indisponible."));
    } finally {
      if (alive) {
        setBusy(false);
        if (pendingSearch) {
          pendingSearch = false;
          void search(0, true);
        }
      }
    }
  }
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
            setStations([]);
            setLoaded(false);
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
          <Feedback error message={error()} onClose={() => setError("")} />
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
                <path
                  class="radio-wave"
                  d="M0 70 Q25 20 50 70 T100 70 T150 70 T200 70 T250 70 T300 70 T350 70 T400 70 T450 70 T500 70 T550 70 T600 70 T650 70 T700 70 T750 70 T800 70 T850 70 T900 70"
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
                onInput={(e) => setSelected(Number(e.currentTarget.value))}
              />
            </div>
            <p class="muted">
              {t(
                "Glissez le cadran, utilisez les flèches du clavier ou choisissez une station, puis lancez l’écoute.",
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
                    onClick={() => setSelected(i())}
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
