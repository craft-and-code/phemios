import { PlayerTransport } from "./PlayerTransport";
import { useLibrary } from "../library/context";
import { t } from "../i18n";
import { Icon } from "./Icon";
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
/** Finite podcast transport shares the footer axis, volume and attached Stop shape. */
export function PodcastPlayerBar() {
  const player = useLibrary().podcast;
  const status = () =>
    ({
      idle: t("Arrêtée"),
      connecting: t("Chargement du podcast…"),
      playing: t("Lecture"),
      paused: t("En pause"),
      ended: t("Fin de l’épisode"),
      error: t("Lecture interrompue"),
    })[player.status()];
  return (
    <footer class="player-bar podcast-player" aria-label={t("Lecture podcast")}>
      <div class="now-playing">
        <a class="idle-cover" href="#/podcasts" aria-label={t("Ouvrir Podcasts")}>
          <Icon name="podcast" />
        </a>
        <span>
          <strong>{player.episode()?.title}</strong>
          <small>
            {player.podcast()?.title} · {status()}
          </small>
          <small class="playback-error" role="alert" title={player.error()}>
            {player.error()}
          </small>
        </span>
      </div>
      <PlayerTransport
        controls={
          <>
            <div class="play-control">
              <button
                class="play-button"
                aria-label={
                  player.status() === "playing" ? t("Mettre en pause") : t("Reprendre l’épisode")
                }
                disabled={player.status() === "connecting"}
                onClick={() =>
                  void (player.status() === "playing" ? player.pause() : player.resume())
                }
              >
                <Icon name={player.status() === "playing" ? "pause" : "play"} />
              </button>
              <button
                class="icon-button transport-stop"
                aria-label={t("Arrêter le podcast")}
                onClick={player.stop}
              >
                <Icon name="stop" />
              </button>
            </div>
          </>
        }
        timeline={
          <div class="playback-progress">
            <small>{clock(player.position())}</small>
            <input
              type="range"
              min="0"
              max={player.duration() || 1}
              step="1"
              value={player.position()}
              disabled={!player.duration() || ["connecting", "error"].includes(player.status())}
              aria-label={t("Position de lecture")}
              onChange={(e) => player.seek(Number(e.currentTarget.value))}
            />
            <small>{player.duration() ? clock(player.duration()) : "—"}</small>
          </div>
        }
      />
      <div class="player-options">
        <button
          class="speaker-button"
          aria-label={player.volume() === 0 ? t("Rétablir le son") : t("Couper le son")}
          aria-pressed={player.volume() === 0}
          onClick={player.mute}
        >
          <Icon name={player.volume() === 0 ? "muted" : "volume"} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          aria-label={t("Volume")}
          value={player.volume()}
          onInput={(e) => player.changeVolume(Number(e.currentTarget.value))}
        />
      </div>
    </footer>
  );
}
