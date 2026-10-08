import { Icon } from "./Icon";

/** Transport layout stays stable while connection capabilities are initialized. */
export function PlayerBar() {
  return (
    <footer class="player-bar" aria-label="Lecture">
      <div class="now-playing">
        <div class="idle-cover">
          <Icon name="disc" />
        </div>
        <span>
          Aucun morceau en lecture<small>Choisissez un album pour préparer la file.</small>
        </span>
      </div>
      <div class="transport">
        <div class="transport-buttons">
          <button class="icon-button" disabled aria-label="Lecture aléatoire">
            <Icon name="shuffle" />
          </button>
          <button class="icon-button" disabled aria-label="Morceau précédent">
            <Icon name="previous" />
          </button>
          <button class="play-button" disabled aria-label="Lire">
            <Icon name="play" />
          </button>
          <button class="icon-button" disabled aria-label="Morceau suivant">
            <Icon name="next" />
          </button>
          <button class="icon-button" disabled aria-label="Répétition">
            <Icon name="repeat" />
          </button>
        </div>
        <div class="playback-progress">
          <small>0:00</small>
          <input type="range" disabled aria-label="Position de lecture" />
          <small>0:00</small>
        </div>
      </div>
      <div class="player-options">
        <select disabled aria-label="Sortie audio">
          <option>Sortie audio</option>
        </select>
        <label>
          <Icon name="volume" />
          <input type="range" disabled aria-label="Volume" />
        </label>
      </div>
    </footer>
  );
}
