import { RefreshButton } from "./RefreshButton";
import { NetworkAudio } from "./NetworkAudio";
import { cdReference } from "../cd/model";
import { DurationToggle } from "./DurationToggle";
import { PlayerTransport } from "./PlayerTransport";
import { playbackToggleAction, repeatDisabled } from "../navigation/contextual-play";
import { playbackDisplay } from "../library/playback-display";
import { ChoiceSelect } from "./ChoiceSelect";
import { WaveformSeek } from "./WaveformSeek";
import { PlayingFavourite } from "./PlayingFavourite";
import { t } from "../i18n";
import { createMemo, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { PlayingBars } from "./PlayingBars";
import { Artwork } from "./Artwork";
import { Icon } from "./Icon";
const time = (ms: number | null) =>
  ms === null
    ? "—"
    : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
/** The transport follows native consumed frames, independent of the open catalog page. */
export function PlayerBar(props: { playbackView?: boolean } = {}) {
  let audioSettings: HTMLDetailsElement | undefined;
  const library = useLibrary(),
    player = library.player,
    state = player.state;
  const refreshIdentity = createMemo(() => ({
    local: library.localSession(),
    server: library.serverSession(),
  }));
  const position = player.seekPosition;
  const displayed = () => playbackDisplay(player.current(), state(), player.queue());
  const cover = () => displayed()?.album;
  const active = () => ["playing", "paused"].includes(state().status);
  const toggleAction = () => playbackToggleAction(state().status);
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
          when={cover()}
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
              <Show when={displayed()} fallback={t("Aucun morceau en lecture")}>
                {(row) => (
                  <a
                    class="playing-track-link"
                    href={
                      cdReference(row().reference)
                        ? "#/cd"
                        : `#/track/${encodeURIComponent(row().reference)}`
                    }
                  >
                    {row().title}
                  </a>
                )}
              </Show>
            </strong>
            <Show when={player.current() && !player.isCd() ? player.current() : undefined}>
              {(row) => <PlayingFavourite reference={row().reference} />}
            </Show>
          </span>
          <small>
            <Show when={displayed()?.album?.artist} fallback={displayed()?.artist}>
              {(artist) => (
                <a class="playing-artist-link" href={`#/artist/${encodeURIComponent(artist())}`}>
                  {displayed()?.artist}
                </a>
              )}
            </Show>{" "}
            {player.current() ? "· " : ""}
            <Show when={player.current() || !displayed()}>{status()}</Show>
          </small>
          <Show when={issue()}>
            <small class="playback-error" role="alert" title={issue()}>
              {issue()}
            </small>
          </Show>
        </span>
      </div>
      <PlayerTransport
        controls={
          <>
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
                disabled={!player.canTogglePlayback()}
                aria-label={
                  toggleAction() === "pause"
                    ? t("Mettre en pause")
                    : toggleAction() === "resume"
                      ? t("Reprendre la lecture")
                      : t("Lancer la lecture")
                }
                onClick={() => void player.togglePlayback()}
              >
                <Icon name={toggleAction() === "pause" ? "pause" : "play"} />
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
                    ? state().queue.indexOf(state().index) + 1 >= state().queue.length
                    : state().index + 1 >= state().total))
              }
              aria-label={t("Morceau suivant")}
              onClick={() => void player.action("next")}
            >
              <Icon name="next" />
            </button>
            <button
              class="icon-button"
              disabled={repeatDisabled(
                state().status,
                player.busy(),
                player.ready(),
                state().device === "@hqplayer",
              )}
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
          </>
        }
        timeline={
          <div class="playback-progress">
            <small>{time(position())}</small>
            <WaveformSeek />
            <DurationToggle
              duration={state().duration_ms}
              position={position()}
              remaining={player.remaining()}
              onToggle={player.toggleTime}
            />
          </div>
        }
      />
      <div class="player-options">
        <Show
          when={active() || props.playbackView}
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
            data-view-toggle="playback"
            aria-current={props.playbackView ? "page" : undefined}
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
              <RefreshButton
                identity={refreshIdentity()}
                class="audio-output-refresh"
                label={t("Actualiser les sorties audio")}
                busy={player.discovering()}
                disabled={!player.ready() || player.busy()}
                onCancel={player.cancelDiscovery}
                onRefresh={() => player.discover()}
              />
            </div>
            <label>
              {t("Mode de lecture")}{" "}
              <ChoiceSelect
                label={t("Mode de lecture")}
                disabled={
                  !player.ready() ||
                  player.busy() ||
                  player.device() === "@hqplayer" ||
                  player.isCd()
                }
                value={
                  player.isCd()
                    ? "without-effects"
                    : player.device() === "@hqplayer"
                      ? "hqplayer"
                      : player.policy()
                }
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
            <Show
              when={["playing", "paused", "connecting"].includes(state().status) && !player.isCd()}
            >
              <small>{t("Mode appliqué aux prochains titres, sans interrompre la lecture.")}</small>
            </Show>
            <label>
              {t("Fondu entre les titres")} · {player.crossfade() / 1000} s
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={player.crossfade()}
                disabled={
                  !player.ready() ||
                  player.busy() ||
                  player.device() === "@hqplayer" ||
                  player.isCd() ||
                  player.policy() !== "dsp"
                }
                aria-label={t("Durée du fondu")}
                onInput={(event) => void player.chooseCrossfade(Number(event.currentTarget.value))}
              />
            </label>
            <small>{t("Activez le mode DSP pour utiliser le fondu.")}</small>
            <NetworkAudio />
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
