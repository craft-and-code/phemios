import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { Icon } from "./Icon";
/** Live radio shares the footer location; pause releases the stream, resume rejoins the live broadcast. */
export function RadioPlayerBar() {
  const radio = useLibrary().radio;
  const status = () =>
    ({
      idle: t("Arrêtée"),
      connecting: t("Connexion du direct…"),
      playing: t("En direct"),
      paused: t("En pause"),
      error: t("Flux interrompu"),
    })[radio.status()];
  return (
    <footer class="player-bar radio-player" aria-label={t("Lecture radio")}>
      <div class="now-playing">
        <a class="idle-cover" href="#/radio" aria-label={t("Ouvrir Radio")}>
          <Icon name="radio" />
        </a>
        <span>
          <strong>{radio.station()?.name}</strong>
          <small>
            {radio.station()?.country} · {status()}
          </small>
          <small class="playback-error" role="alert">
            {radio.error()}
          </small>
        </span>
      </div>
      <div class="transport">
        <div class="transport-buttons">
          <div class="play-control">
            <button
              class="play-button"
              aria-label={
                radio.status() === "playing"
                  ? t("Mettre la radio en pause")
                  : t("Reprendre la radio en direct")
              }
              disabled={radio.status() === "connecting"}
              onClick={() => (radio.status() === "playing" ? radio.pause() : radio.resume())}
            >
              <Icon name={radio.status() === "playing" ? "pause" : "play"} />
            </button>
            <button
              class="icon-button transport-stop"
              aria-label={t("Arrêter la radio")}
              onClick={radio.stop}
            >
              <Icon name="stop" />
            </button>
          </div>
        </div>
        <small class="radio-live">{t("DIRECT · RADIO INTERNET")}</small>
      </div>
      <div class="player-options">
        <button
          class="speaker-button"
          aria-label={
            radio.volume() === 0 ? t("Rétablir le son de la radio") : t("Couper le son de la radio")
          }
          aria-pressed={radio.volume() === 0}
          onClick={radio.mute}
        >
          <Icon name={radio.volume() === 0 ? "muted" : "volume"} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          aria-label={t("Volume de la radio")}
          value={radio.volume()}
          onInput={(e) => radio.changeVolume(Number(e.currentTarget.value))}
        />
      </div>
    </footer>
  );
}
