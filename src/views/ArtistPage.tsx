import { createMemo, Show } from "solid-js";
import { AlbumGrid } from "../components/AlbumGrid";
import { useLibrary } from "../library/context";
import { belongsToArtist, filterAlbums } from "../library/filtering";
import { sourceLink } from "../library/server";
import type { Artist, Filters } from "../library/types";
/** Present local editions and contributions without inventing a principal credit. */
export function ArtistPage(props: { artist: Artist; filters: Filters; reverse: boolean }) {
  const library = useLibrary();
  const sort = (items: readonly import("../library/types").Album[]) =>
    [...items].sort((a, b) => a.title.localeCompare(b.title, "fr") * (props.reverse ? -1 : 1));
  const albums = createMemo(() =>
    sort(
      filterAlbums(
        library.albums().filter((album) => album.artist === props.artist.reference),
        library.artists(),
        props.filters,
      ),
    ),
  );
  const appearances = createMemo(() =>
    sort(
      filterAlbums(
        library
          .albums()
          .filter(
            (album) =>
              album.artist !== props.artist.reference &&
              (belongsToArtist(album, props.artist) ||
                (library.demo &&
                  props.artist.reference === "oree" &&
                  album.reference === "meetings")),
          ),
        library.artists(),
        props.filters,
      ),
    ),
  );
  const banner = () =>
    library.demo && props.artist.artwork
      ? "/demo/landscape.svg"
      : library.image(props.artist.reference, "banner");
  const background = () =>
    library.demo && props.artist.artwork
      ? "/demo/landscape.svg"
      : library.image(props.artist.reference, "background");
  return (
    <article
      class="artist-page"
      classList={{ "has-backdrop": !!background() }}
      style={
        background()
          ? { "background-image": `linear-gradient(#111213e8,#111213f5),url("${background()}")` }
          : {}
      }
    >
      <header
        class="artist-hero"
        style={
          banner()
            ? {
                "background-image": `linear-gradient(90deg,#101917dd,#11191735),url("${banner()}")`,
              }
            : {}
        }
      >
        <a class="back" href="#/artists">
          ← Tous les artistes
        </a>
        <div>
          <p class="eyebrow">ARTISTE</p>
          <h1>{props.artist.name}</h1>
          <p>
            {props.artist.genre} · {props.artist.country ?? "Origine inconnue"}
          </p>
        </div>
      </header>
      <div class="page artist-content">
        <div class="section-heading">
          <h2>Discographie</h2>
          <span role="status">{albums().length} albums dans la sélection</span>
        </div>
        <AlbumGrid albums={albums()} />
        <Show when={appearances().length}>
          <h2>Participations</h2>
          <AlbumGrid albums={appearances()} />
        </Show>
        <section class="biography">
          <h2>Biographie</h2>
          <p>{props.artist.biography || "Aucune biographie récupérée pour cet artiste."}</p>
          <Show when={props.artist.biographyCredit}>
            {(credit) => (
              <small>
                <Show when={sourceLink(credit().url)} fallback={credit().url}>
                  {(url) => (
                    <a href={url()} target="_blank" rel="noreferrer">
                      Source de la biographie
                    </a>
                  )}
                </Show>{" "}
                · {credit().lang} · {credit().licence}
              </small>
            )}
          </Show>
          <Show when={library.demo}>
            <small>Texte fictif pour l’aperçu.</small>
          </Show>
        </section>
      </div>
    </article>
  );
}
