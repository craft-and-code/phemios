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
            <div class="playing-cover">
              <Artwork album={current().album} />
            </div>
          )}
        </Show>
        <span>
          <strong>{player.current()?.title ?? "Aucun morceau en lecture"}</strong>
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
            disabled={player.busy() || !["playing", "paused", "ended"].includes(state().status)}
            aria-label={state().status === "playing" ? "Mettre en pause" : "Reprendre la lecture"}
            onClick={() => void player.action(state().status === "playing" ? "pause" : "resume")}
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
          <small>{time(state().duration_ms)}</small>
        </div>
      </div>
      <div class="player-options">
        <button
          class="icon-button"
          aria-label="Actualiser les sorties audio"
          disabled={!player.ready() || player.busy()}
          onClick={() => void player.discover()}
        >
          <Icon name="volume" />
        </button>
        <select
          aria-label="Sortie audio"
          disabled={!player.ready() || player.busy()}
          value={player.device()}
          onFocus={() => {
            if (!player.outputs().length) void player.discover();
          }}
          onChange={(event) => void player.chooseOutput(event.currentTarget.value)}
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
        <label>
          <Icon name="volume" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state().volume}
            disabled={!player.ready() || player.busy()}
            aria-label="Volume"
            onInput={(event) => void player.volume(Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </footer>
  );
}
