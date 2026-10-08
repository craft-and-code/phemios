import { createSignal, For } from "solid-js";
import { Artwork } from "../components/Artwork";
import { demoArtists } from "../demo/catalog";
import type { Album } from "../library/types";

/** Annotation controls are an explicitly temporary draft, never persisted silently. */
export function AlbumPage(props: { album: Album }) {
  const [rating, setRating] = createSignal(0);
  const [favourite, setFavourite] = createSignal(false);
  const artist = () => demoArtists.find((item) => item.reference === props.album.artist);
  return (
    <article class="page album-page">
      <a class="back" href={`#/artist/${props.album.artist}`}>
        ← {artist()?.name}
      </a>
      <div class="album-hero">
        <Artwork album={props.album} />
        <div>
          <p class="eyebrow">ALBUM · CATALOGUE FICTIF</p>
          <h1>{props.album.title}</h1>
          <p>
            {artist()?.name} · {props.album.year ?? "Année inconnue"}
          </p>
          <button class="primary" disabled>
            Lecture non connectée
          </button>
        </div>
      </div>
      <section class="annotation-panel">
        <h2>Votre regard sur cet album</h2>
        <p class="notice">
          Essai de l’interface : ces brouillons sont perdus en quittant cette page. Le stockage des
          annotations reste à raccorder.
        </p>
        <div class="annotation-controls">
          <fieldset>
            <legend>Note personnelle</legend>
            <div class="stars">
              <For each={[1, 2, 3, 4, 5]}>
                {(value) => (
                  <button
                    aria-label={`${value} étoile(s)`}
                    aria-pressed={rating() === value}
                    classList={{ selected: value <= rating() }}
                    onClick={() => setRating(rating() === value ? 0 : value)}
                  >
                    ★
                  </button>
                )}
              </For>
            </div>
          </fieldset>
          <button aria-pressed={favourite()} onClick={() => setFavourite(!favourite())}>
            {favourite() ? "♥ Favori" : "♡ Ajouter aux favoris"}
          </button>
        </div>
        <label>
          Tags
          <input
            placeholder="Séparez les tags par des virgules"
            value={props.album.tags.join(", ")}
          />
        </label>
        <label>
          Notes personnelles
          <textarea rows="4" placeholder="Une impression, un souvenir, une recommandation…" />
        </label>
      </section>
      <section>
        <h2>Pistes, crédits et spectres</h2>
        <p class="muted">
          Aucune piste audio n’est incluse dans cette démonstration. Les analyses FlacCompagnon,
          spectres et crédits apparaîtront ici lorsqu’ils seront disponibles.
        </p>
      </section>
    </article>
  );
}
