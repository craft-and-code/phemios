import { For, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { Artwork } from "./Artwork";
import { Icon } from "./Icon";
const time = (ms: number | null) =>
  ms === null
    ? "—"
    : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
/** The transport follows native consumed frames, independent of the open catalog page. */
export function PlayerBar() {
  const player = useLibrary().player,
    state = player.state;
  const active = () => ["playing", "paused"].includes(state().status);
  const disabled = () => player.busy() || !active();
  const issue = () => player.error() || state().error;
  const status = () =>
    ({
      idle: "Choisissez un album ou une piste.",
      connecting: "Connexion du flux audio…",
      playing: "Lecture",
      paused: "En pause",
      ended: "Fin de la sélection",
      error: "Lecture interrompue",
    })[state().status];
  return (
    <footer class="player-bar" aria-label="Lecture">
      <div class="now-playing">
        <Show
          when={player.current()}
          fallback={
            <div class="idle-cover">
              <Icon name="disc" />
            </div>
          }
        >
          {(current) => (
            <a
              class="playing-cover"
              href={`#/album/${encodeURIComponent(current().album.reference)}`}
              aria-label={`Ouvrir ${current().album.title}`}
            >
              <Artwork album={current().album} />
            </a>
          )}
        </Show>
        <span>
          <strong>
            <Show when={player.current()}>
              {(row) => (
                <span class="playing-position">
                  {row().number}/{row().albumTotal} ·{" "}
                </span>
              )}
            </Show>
            {player.current()?.title ?? "Aucun morceau en lecture"}
          </strong>
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
            disabled
            aria-label="Lecture aléatoire"
            title="Lecture aléatoire : prochain raccordement"
          >
            <Icon name="shuffle" />
          </button>
          <button
            class="icon-button"
            disabled={disabled()}
            aria-label="Morceau précédent"
            onClick={() => void player.action("previous")}
          >
            <Icon name="previous" />
          </button>
          <button
            class="play-button"
            disabled={
              player.busy() ||
              (!player.ready() && !active()) ||
              (!active() && state().status !== "ended" && !player.target())
            }
            aria-label={
              state().status === "playing"
                ? "Mettre en pause"
                : active()
                  ? "Reprendre la lecture"
                  : "Lancer la lecture"
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
            class="icon-button"
            disabled={disabled() || state().index + 1 >= state().total}
            aria-label="Morceau suivant"
            onClick={() => void player.action("next")}
          >
            <Icon name="next" />
          </button>
          <button
            class="icon-button"
            disabled
            aria-label="Répétition"
            title="Répétition : prochain raccordement"
          >
            <Icon name="repeat" />
          </button>
          <button
            class="icon-button"
            disabled={
              player.busy() ||
              !["playing", "paused", "connecting", "ended", "error"].includes(state().status)
            }
            aria-label="Arrêter la lecture"
            onClick={() => void player.action("stop")}
          >
            <Icon name="stop" />
          </button>
        </div>
        <div class="playback-progress">
          <small>{time(state().position_ms)}</small>
          <input
            type="range"
            min="0"
            max={state().duration_ms ?? 1}
            step="1000"
            value={state().position_ms}
            disabled={disabled() || !state().duration_ms}
            aria-label="Position de lecture"
            onChange={(event) => void player.action("seek", Number(event.currentTarget.value))}
          />
          <button
            class="time-toggle"
            aria-label={
              player.remaining() ? "Afficher la durée totale" : "Afficher le temps restant"
            }
            aria-pressed={player.remaining()}
            onClick={player.toggleTime}
          >
            {player.remaining() && state().duration_ms !== null
              ? `−${time(Math.max(0, state().duration_ms! - state().position_ms))}`
              : time(state().duration_ms)}
          </button>
        </div>
      </div>
      <div class="player-options">
        <details class="audio-settings">
          <summary
            class="icon-button"
            aria-label="Réglages audio"
            title="Sortie et mode de lecture"
          >
            <Icon name="settings" />
          </summary>
          <div class="audio-settings-panel">
            <label>
              Sortie audio
              <select
                aria-label="Sortie audio"
                disabled={!player.ready() || player.busy()}
                value={player.device()}
                onFocus={() => {
                  if (!player.outputs().length) void player.discover();
                }}
                onChange={(e) => void player.chooseOutput(e.currentTarget.value)}
              >
                <option value="">Sortie système</option>
                <For each={player.outputs()}>
                  {(output) => (
                    <option value={output.id}>
                      {output.name}
                      {output.default ? " (par défaut)" : ""}
                    </option>
                  )}
                </For>
              </select>
            </label>
            <button
              class="icon-button"
              aria-label="Actualiser les sorties audio"
              title="Actualiser les sorties audio"
              disabled={!player.ready() || player.busy()}
              onClick={() => void player.discover()}
            >
              <Icon name="refresh" />
            </button>
            <label>
              Mode de lecture
              <select
                aria-label="Mode de lecture"
                disabled={!player.ready() || player.busy()}
                value={player.policy()}
                onChange={(e) => void player.choosePolicy(e.currentTarget.value)}
              >
                <option value="without-effects">Sans DSP</option>
                <option value="dsp">DSP · normalisation album</option>
                <option value="bit-perfect" disabled>
                  Bit-perfect · indisponible sur ce flux
                </option>
              </select>
            </label>
            <small>
              Sans DSP : effets désactivés ; adaptation au format de la sortie et volume restent
              actifs. Le flux PCM distant et la sortie système ne garantissent pas le bit-perfect.
            </small>
          </div>
        </details>
        <button
          class="speaker-button"
          disabled={!player.ready() && !active()}
          aria-label={state().volume === 0 ? "Rétablir le son" : "Couper le son"}
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
          disabled={!player.ready() && !active()}
          aria-label="Volume"
          onInput={(e) => void player.volume(Number(e.currentTarget.value))}
        />
      </div>
    </footer>
  );
}
