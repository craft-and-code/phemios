import { ChoiceSelect } from "./ChoiceSelect";
import { WaveformSeek } from "./WaveformSeek";
import { PlayingFavourite } from "./PlayingFavourite";
import { t } from "../i18n";
import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { PlayingBars } from "./PlayingBars";
import { Artwork } from "./Artwork";
import { Icon } from "./Icon";
const time = (ms: number | null) =>
  ms === null
    ? "—"
    : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
/** The transport follows native consumed frames, independent of the open catalog page. */
export function PlayerBar() {
  let audioSettings: HTMLDetailsElement | undefined;
  const player = useLibrary().player,
    state = player.state;
  const position = player.seekPosition;
  const active = () => ["playing", "paused"].includes(state().status);
  const disabled = () => player.busy() || !active();
  const issue = () => t(player.error() || state().error || "");
  const status = () =>
    ({
      idle: t("Choisissez un album ou une piste."),
      connecting: t("Connexion du flux audio…"),
      playing: t("Lecture"),
      paused: t("En pause"),
      ended: t("Fin de la sélection"),
      error: t("Lecture interrompue"),
    })[state().status];
  return (
    <footer class="player-bar" aria-label={t("Lecture")}>
      <div class="now-playing">
        <Show
          when={player.current()?.album}
          fallback={
            <div class="idle-cover">
              <Icon name="disc" />
            </div>
          }
        >
          {(current) => (
            <a
              class="playing-cover"
              href={`#/album/${encodeURIComponent(current().reference)}`}
              aria-label={t("Ouvrir {0}", current().title)}
            >
              <Artwork album={current()} thumbnail />
            </a>
          )}
        </Show>
        <span>
          <span class="playing-title-line">
            <strong>
              <Show when={player.current()}>
                {(row) => (
                  <span class="playing-position">
                    {row().number}/{row().albumTotal} ·{" "}
                  </span>
                )}
              </Show>
              <PlayingBars reference={player.current()?.reference ?? ""} />
              <Show when={player.current()} fallback={t("Aucun morceau en lecture")}>
                {(row) => (
                  <a
                    class="playing-track-link"
                    href={`#/track/${encodeURIComponent(row().reference)}`}
                  >
                    {row().title}
                  </a>
                )}
              </Show>
            </strong>
            <Show when={player.current()}>
              {(row) => <PlayingFavourite reference={row().reference} />}
            </Show>
          </span>
          <small>
            {player.current()?.artist} {player.current() ? "· " : ""}
            {status()}
          </small>
          <Show when={issue()}>
            <small class="playback-error" role="alert">
              {issue()}
            </small>
          </Show>
        </span>
      </div>
      <div class="transport">
        <div class="transport-buttons">
          <button
            class="icon-button"
            disabled={disabled()}
            aria-label={t("Lecture aléatoire")}
            title={t("Lecture aléatoire")}
            aria-pressed={state().shuffled}
            onClick={() => void player.action("shuffle", !state().shuffled)}
          >
            <Icon name="shuffle" />
          </button>
          <button
            class="icon-button"
            disabled={disabled()}
            aria-label={t("Morceau précédent")}
            onClick={() => void player.action("previous")}
          >
            <Icon name="previous" />
          </button>

          <div class="play-control">
            <button
              class="play-button"
              disabled={
                player.busy() ||
                (!player.ready() && !active()) ||
                (!active() && state().status !== "ended" && !player.target())
              }
              aria-label={
                state().status === "playing"
                  ? t("Mettre en pause")
                  : active()
                    ? t("Reprendre la lecture")
                    : t("Lancer la lecture")
              }
              onClick={() =>
                void (state().status === "playing"
                  ? player.action("pause")
                  : state().status === "paused"
                    ? player.action("resume")
                    : player.target()
                      ? player.startReference()
                      : player.action("resume"))
              }
            >
              <Icon name={state().status === "playing" ? "pause" : "play"} />
            </button>
            <button
              class="icon-button transport-stop"
              disabled={
                player.busy() ||
                !["playing", "paused", "connecting", "ended", "error"].includes(state().status)
              }
              aria-label={t("Arrêter la lecture")}
              onClick={() => void player.action("stop")}
            >
              <Icon name="stop" />
            </button>
          </div>
          <button
            class="icon-button"
            disabled={
              disabled() ||
              (state().repeat !== "all" &&
                (state().queue.length
                  ? state().queue.indexOf(state().index) + 1 >= state().total
                  : state().index + 1 >= state().total))
            }
            aria-label={t("Morceau suivant")}
            onClick={() => void player.action("next")}
          >
            <Icon name="next" />
          </button>
          <button
            class="icon-button"
            disabled={!player.ready() || player.busy() || state().device === "@hqplayer"}
            aria-label={t("Répétition")}
            aria-pressed={state().repeat !== "off"}
            title={t(
              state().repeat === "one"
                ? "Répéter le morceau"
                : state().repeat === "all"
                  ? "Répéter la sélection"
                  : "Répétition désactivée",
            )}
            onClick={() =>
              void player.action(
                "repeat",
                state().repeat === "off" ? "all" : state().repeat === "all" ? "one" : "off",
              )
            }
          >
            <Icon name={state().repeat === "one" ? "repeat-one" : "repeat"} />
          </button>
        </div>
        <div class="playback-progress">
          <small>{time(position())}</small>
          <WaveformSeek />
          <button
            class="time-toggle"
            aria-label={
              player.remaining() ? t("Afficher la durée totale") : t("Afficher le temps restant")
            }
            aria-pressed={player.remaining()}
            onClick={player.toggleTime}
          >
            {player.remaining() && state().duration_ms !== null
              ? `−${time(Math.max(0, state().duration_ms! - position()))}`
              : time(state().duration_ms)}
          </button>
        </div>
      </div>
      <div class="player-options">
        <Show
          when={active()}
          fallback={
            <button
              class="icon-button quiet playback-view-action"
              disabled
              aria-label={t("Ouvrir la vue Lecture")}
              title={t("Ouvrir la vue Lecture")}
            >
              <Icon name="visualizer" />
            </button>
          }
        >
          <a
            class="icon-button quiet playback-view-action"
            href="#/playback"
            aria-label={t("Ouvrir la vue Lecture")}
            title={t("Ouvrir la vue Lecture")}
          >
            <Icon name="visualizer" />
          </a>
        </Show>

        <details
          class="audio-settings"
          ref={(element) => {
            audioSettings = element;
          }}
        >
          <summary
            class="icon-button"
            aria-label={t("Réglages audio")}
            title={t("Sortie et mode de lecture")}
          >
            <Icon name="settings" />
          </summary>
          <div class="audio-settings-panel">
            <button
              class="icon-button quiet icon-close audio-settings-close"
              aria-label={t("Fermer les réglages audio")}
              title={t("Fermer")}
              onClick={() => {
                if (audioSettings) audioSettings.open = false;
              }}
            >
              <Icon name="close" />
            </button>
            <div class="audio-output-row">
              <label class="audio-output-label">
                <span>{t("Sortie audio")}</span>{" "}
                <ChoiceSelect
                  label={t("Sortie audio")}
                  disabled={!player.ready() || player.busy() || player.discovering()}
                  value={player.device()}
                  onFocus={() => {
                    if (!player.outputs().length) void player.discover();
                  }}
                  onChange={(value) => void player.chooseOutput(value)}
                  options={[
                    { value: "", label: t("Sortie système") },
                    ...player.outputs().map((output) => ({
                      value: output.id,
                      label: output.name + (output.default ? t(" (par défaut)") : ""),
                    })),
                  ]}
                />
              </label>
              <button
                class="icon-button audio-output-refresh"
                aria-busy={player.discovering()}
                aria-label={t("Actualiser les sorties audio")}
                title={t("Actualiser les sorties audio")}
                disabled={!player.ready() || player.busy() || player.discovering()}
                onClick={() => void player.discover()}
              >
                <Show when={player.discovering()} fallback={<Icon name="refresh" />}>
                  <span class="spinner" aria-hidden="true" />
                </Show>
              </button>
            </div>
            <Show when={player.discovering()}>
              <small role="status">{t("Actualisation des sorties audio…")}</small>
            </Show>
            <label>
              {t("Mode de lecture")}{" "}
              <ChoiceSelect
                label={t("Mode de lecture")}
                disabled={!player.ready() || player.busy() || player.device() === "@hqplayer"}
                value={player.device() === "@hqplayer" ? "hqplayer" : player.policy()}
                onChange={(value) => void player.choosePolicy(value)}
                options={[
                  { value: "hqplayer", label: t("Traitement HQPlayer"), disabled: true },
                  { value: "without-effects", label: t("Sans DSP") },
                  { value: "dsp", label: t("DSP · normalisation album") },
                  {
                    value: "bit-perfect",
                    label: t("Bit-perfect · indisponible sur ce flux"),
                    disabled: true,
                  },
                ]}
              />
            </label>
            <label>
              {t("Fondu entre les titres")} · {player.crossfade() / 1000} s
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={player.crossfade()}
                disabled={!player.ready() || player.busy() || player.device() === "@hqplayer"}
                aria-label={t("Durée du fondu")}
                onChange={(event) => void player.chooseCrossfade(Number(event.currentTarget.value))}
              />
            </label>
            <small>
              {t(
                "Le fondu nécessite le mode DSP. Ses réglages ne redémarrent pas le morceau ; un fondu déjà commencé se termine avec sa durée initiale.",
              )}
            </small>
            <small>
              {t(
                "Sans DSP : effets désactivés ; adaptation au format de la sortie et volume restent actifs. Le flux PCM distant et la sortie système ne garantissent pas le bit-perfect.",
              )}{" "}
            </small>
          </div>
        </details>
        <button
          class="speaker-button"
          aria-label={state().volume === 0 ? t("Rétablir le son") : t("Couper le son")}
          aria-pressed={state().volume === 0}
          onClick={() => void player.toggleMute()}
        >
          <Icon name={state().volume === 0 ? "muted" : "volume"} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state().volume}
          aria-label={t("Volume")}
          onInput={(e) => void player.volume(Number(e.currentTarget.value))}
        />
      </div>
    </footer>
  );
}
