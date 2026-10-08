import { createSignal, Show } from "solid-js";
import { type Section } from "../navigation/routes";

const descriptions: Partial<Record<Section, string>> = {
  favourites: "Retrouvez les artistes et albums marqués comme favoris.",
  collections: "Créez des collections et choisissez leurs règles ou leurs albums.",
  history: "Retrouvez les dernières écoutes et reprenez vos découvertes.",
  playlists: "Enregistrez vos listes M3U sur Aède et téléchargez-les pour le lecteur choisi.",
  analysis:
    "Lancez une analyse FlacCompagnon ou la génération des spectres, puis consultez leurs résultats.",
  relations:
    "Découvrez les membres, invités et collaborations entre groupes avec leurs rôles et leurs périodes.",
  players: "Préparez la copie d’une sélection vers un lecteur, une carte ou un disque connecté.",
};

/** Future services remain unavailable; changing a plan never writes music files. */
export function WorkspacePage(props: { section: Section }) {
  const [convert, setConvert] = createSignal(false);
  return (
    <section class="page workspace-page">
      <p class="intro">{descriptions[props.section]}</p>
      <Show
        when={props.section === "players"}
        fallback={
          <div class="service-placeholder">
            <h2>Service à raccorder</h2>
            <p>
              Cette rubrique est prévue dans le parcours. Le socle actuel ne se connecte pas encore
              au serveur Aède.
            </p>
            <Show when={props.section === "relations"}>
              <p>
                Le futur graphe distinguera les membres d’un groupe des collaborations et conservera
                la source de chaque lien.
              </p>
            </Show>
            <Show when={props.section === "collections"}>
              <button disabled>Créer une collection — connexion requise</button>
            </Show>
            <Show when={props.section === "playlists"}>
              <button disabled>Enregistrer / télécharger — connexion requise</button>
            </Show>
          </div>
        }
      >
        <div class="transfer-plan">
          <h2>Préparer un transfert</h2>
          <p class="notice">
            La détection des lecteurs n’est pas encore connectée. Les choix ci-dessous illustrent le
            formulaire ; aucune copie n’est lancée.
          </p>
          <label>
            Destination
            <select disabled>
              <option>Service des lecteurs non connecté</option>
            </select>
          </label>
          <label>
            Musique
            <select disabled>
              <option>Sélection ou collection à choisir</option>
            </select>
          </label>
          <fieldset>
            <legend>Vérification et conversion</legend>
            <label>
              <input type="checkbox" checked />
              Vérifier les fichiers après la copie
            </label>
            <label>
              <input type="checkbox" />
              Vérifier aussi les fichiers déjà présents
            </label>
            <label>
              <input
                type="checkbox"
                checked={convert()}
                onChange={(event) => setConvert(event.currentTarget.checked)}
              />
              Convertir pour le lecteur
            </label>
            <Show when={convert()}>
              <label>
                Format
                <select disabled>
                  <option>Formats compatibles à déterminer</option>
                </select>
              </label>
            </Show>
            <label>
              <input type="checkbox" checked />
              Inclure les pochettes disponibles
            </label>
            <label>
              <input type="checkbox" />
              Inclure une liste M3U
            </label>
          </fieldset>
          <button class="primary" disabled>
            Prévisualiser le transfert — service requis
          </button>
          <p class="muted">
            Les fichiers sources seront conservés. La prévisualisation présentera les conversions,
            les conflits et les vérifications avant tout transfert.
          </p>
        </div>
      </Show>
    </section>
  );
}
