import { createMemo, For, Show } from "solid-js";
import { AlbumGrid } from "../components/AlbumGrid";
import { Artwork } from "../components/Artwork";
import { demoAlbums, demoArtists } from "../demo/catalog";
import { filterAlbums, filterArtists, normalizeName } from "../library/filtering";
import type { Filters } from "../library/types";
import type { Section } from "../navigation/routes";

/** Only sourced demo origins are grouped; unknown values have their own choice. */
export function LibraryPage(props: {
  section: Section;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  reverse: boolean;
}) {
  const country = () => props.filters.country;
  const setCountry = (country: string | null | undefined) =>
    props.setFilters({ ...props.filters, country });
  const genre = () => props.filters.genre;
  const setGenre = (genre: string | undefined) => props.setFilters({ ...props.filters, genre });
  const compare = (a: string, b: string) =>
    normalizeName(a).localeCompare(normalizeName(b), "fr") * (props.reverse ? -1 : 1);
  const artists = createMemo(() => {
    const matched = filterArtists(demoArtists, demoAlbums, props.filters);
    return [...matched]
      .filter(
        (item) =>
          props.section !== "countries" || country() === undefined || item.country === country(),
      )
      .filter((item) => props.section !== "genres" || !genre() || item.genre === genre())
      .sort((a, b) => compare(a.name, b.name));
  });
  const albums = createMemo(() =>
    [...filterAlbums(demoAlbums, demoArtists, props.filters)]
      .filter((item) => props.section !== "compilations" || item.compilation)
      .sort((a, b) => compare(a.title, b.title)),
  );
  const artistView = () => ["artists", "countries", "genres"].includes(props.section);
  return (
    <section class="page library-page" aria-label="Catalogue">
      <div class="page-heading">
        <span role="status">{artistView() ? artists().length : albums().length} résultat(s)</span>
      </div>
      <Show when={props.section === "countries"}>
        <p class="notice">
          Le globe rotatif et zoomable sera ajouté avec ses frontières géographiques locales. Cette
          première étape propose la sélection par pays.
        </p>
        <div class="choices" aria-label="Pays d’origine">
          <button aria-pressed={country() === undefined} onClick={() => setCountry(undefined)}>
            Tous
          </button>
          <For each={[...new Set(demoArtists.map((item) => item.country))]}>
            {(value) => (
              <button aria-pressed={country() === value} onClick={() => setCountry(value)}>
                {value ?? "Origine inconnue"}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.section === "genres"}>
        <div class="choices" aria-label="Genres">
          <button aria-pressed={!genre()} onClick={() => setGenre(undefined)}>
            Tous
          </button>
          <For each={[...new Set(demoArtists.map((item) => item.genre))]}>
            {(value) => (
              <button aria-pressed={genre() === value} onClick={() => setGenre(value)}>
                {value}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={artistView()} fallback={<AlbumGrid albums={albums()} />}>
        <ul class="artist-grid">
          <For each={artists()}>
            {(artist) => {
              const cover = demoAlbums.find((item) => item.artist === artist.reference);
              return (
                <li>
                  <a class="artist-card" href={`#/artist/${artist.reference}`}>
                    <Show when={cover}>{(album) => <Artwork album={album()} />}</Show>
                    <div>
                      <h2>{artist.name}</h2>
                      <p>
                        {artist.genre} · {artist.country ?? "Origine inconnue"}
                      </p>
                      <small>
                        {demoAlbums.filter((item) => item.artist === artist.reference).length}{" "}
                        albums · ouvrir la page
                      </small>
                    </div>
                  </a>
                </li>
              );
            }}
          </For>
        </ul>
        <Show when={!artists().length}>
          <p class="empty">
            Aucun artiste dans cette sélection. Élargissez les bornes ou effacez la recherche.
          </p>
        </Show>
      </Show>
      <p class="demo-note">
        Données et visuels fictifs. La recherche porte sur les champs de ce catalogue ; la recherche
        globale d’Aède reste à raccorder.
      </p>
    </section>
  );
}
