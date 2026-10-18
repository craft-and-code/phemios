import { Feedback } from "./Feedback";
import { PlayerTransport } from "./PlayerTransport";
import { t } from "../i18n";
import { Icon } from "./Icon";
/** Presentation-only radio footer; callbacks belong to the active transport owner. */
export function RadioPlayerBarView(props: {
  station: { name: string; country: string } | undefined;
  status: "idle" | "connecting" | "playing" | "paused" | "error";
  error: string;
  volume: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMute: () => void;
  onVolume: (value: number) => void;
}) {
  const status = () =>
    ({
      idle: t("Arrêtée"),
      connecting: t("Connexion du direct…"),
      playing: t("En direct"),
      paused: t("En pause"),
      error: t("Flux interrompu"),
    })[props.status];
  return (
    <footer class="player-bar radio-player" aria-label={t("Lecture radio")}>
      <div class="now-playing">
        <a class="idle-cover" href="#/radio" aria-label={t("Ouvrir Radio")}>
          <Icon name="radio" />
        </a>
        <span>
          <strong>{props.station?.name}</strong>
          <small>
            {props.station?.country} · {status()}
          </small>
        </span>
      </div>
      <Feedback
        error
        class="radio-playback-feedback"
        message={props.error}
        durationMs={5000}
        pauseOnInteraction={false}
      />
      <PlayerTransport
        controls={
          <>
            <div class="play-control">
              <button
                class="play-button"
                aria-label={
                  props.status === "playing"
                    ? t("Mettre la radio en pause")
                    : t("Reprendre la radio en direct")
                }
                disabled={props.status === "connecting"}
                onClick={() => (props.status === "playing" ? props.onPause() : props.onResume())}
              >
                <Icon name={props.status === "playing" ? "pause" : "play"} />
              </button>
              <button
                class="icon-button transport-stop"
                aria-label={t("Arrêter la radio")}
                onClick={props.onStop}
              >
                <Icon name="stop" />
              </button>
            </div>
          </>
        }
        timeline={<small class="radio-live">{t("DIRECT · RADIO INTERNET")}</small>}
      />
      <div class="player-options">
        <button
          class="speaker-button"
          aria-label={
            props.volume === 0 ? t("Rétablir le son de la radio") : t("Couper le son de la radio")
          }
          aria-pressed={props.volume === 0}
          onClick={props.onMute}
        >
          <Icon name={props.volume === 0 ? "muted" : "volume"} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          aria-label={t("Volume de la radio")}
          value={props.volume}
          onInput={(e) => props.onVolume(Number(e.currentTarget.value))}
        />
      </div>
    </footer>
  );
}
