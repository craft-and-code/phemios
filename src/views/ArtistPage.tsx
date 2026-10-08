import { createMemo, Show } from "solid-js";
import { AlbumGrid } from "../components/AlbumGrid";
import { demoAlbums, demoArtists } from "../demo/catalog";
import { filterAlbums } from "../library/filtering";
import type { Artist, Filters } from "../library/types";

/** Already bundled artist visuals are optional; no enrichment is triggered here. */
export function ArtistPage(props: { artist: Artist; filters: Filters; reverse: boolean }) {
  const albums = createMemo(() =>
    [
      ...filterAlbums(
        demoAlbums.filter((album) => album.artist === props.artist.reference),
        demoArtists,
        props.filters,
      ),
    ].sort((a, b) => a.title.localeCompare(b.title, "fr") * (props.reverse ? -1 : 1)),
  );
  const appearances = createMemo(() =>
    filterAlbums(
      props.artist.reference === "oree"
        ? demoAlbums.filter((album) => album.reference === "meetings")
        : [],
      demoArtists,
      props.filters,
    ),
  );
  return (
    <article class="artist-page" classList={{ "has-backdrop": props.artist.artwork }}>
      <header class="artist-hero" classList={{ "has-banner": props.artist.artwork }}>
        <a class="back" href="#/artists">
          ← Tous les artistes
        </a>
        <div>
          <p class="eyebrow">ARTISTE · CATALOGUE FICTIF</p>
          <h1>{props.artist.name}</h1>
          <p>
            {props.artist.genre} · {props.artist.country ?? "Origine inconnue"}
          </p>
        </div>
        <Show when={props.artist.artwork}>
          <small>Bannière de démonstration embarquée</small>
        </Show>
      </header>
      <div class="page artist-content">
        <div class="section-heading">
          <h2>Discographie</h2>
          <span role="status">{albums().length} albums dans la sélection</span>
        </div>
        <AlbumGrid albums={albums()} />
        <Show when={appearances().length}>
          <h2>Participations</h2>
          <p class="muted">
            Orée participe à cette compilation fictive, sans en devenir l’artiste principal.
          </p>
          <AlbumGrid albums={appearances()} />
        </Show>
        <section class="biography">
          <h2>Biographie</h2>
          <p>{props.artist.biography}</p>
          <small>
            Texte de démonstration rédigé pour Phémios. Les biographies récupérées afficheront leur
            source.
          </small>
        </section>
        <p class="notice">
          Les membres, crédits datés, images récupérées et liens entre groupes seront raccordés au
          graphe d’Aède.
        </p>
      </div>
    </article>
  );
}
