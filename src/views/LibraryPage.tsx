import { composerAlbumOrder, composerAlbumNames } from "../library/composers";
import { AlbumCount } from "../components/AlbumCount";
import { ArtistGallery } from "../components/ArtistGallery";
import type { ArtistView } from "../library/tool-preferences";
import { createAlbumListening } from "../library/album-listening";
import { Feedback } from "../components/Feedback";
import { ChoiceChips } from "../components/ChoiceChips";
import type { CoverPosition } from "../visualizer/cover-position";
import { CoverFlow } from "../components/CoverFlow";
import { EmptyState } from "../components/EmptyState";
import { locale } from "../i18n";
import { t, countryName } from "../i18n";
import { SourceBadge } from "../components/SourceBadge";
import { createMemo, For, Show } from "solid-js";
import { CountryExplorer } from "../components/CountryExplorer";
import { AlbumGrid } from "../components/AlbumGrid";
import { CoverPlay } from "../components/CoverPlay";
import { Artwork } from "../components/Artwork";
import { useLibrary } from "../library/context";
import { browseArtists, selectCountries } from "../library/selection";
import { catalogIndex, artistCardSelection } from "../library/index";
import { filterAlbums, filterArtists, normalizeName, selectedGenres } from "../library/filtering";
import type { Album, Filters } from "../library/types";
import {
  sectionIcon,
  artistCatalog,
  albumListeningCatalog,
  type Section,
} from "../navigation/routes";

/** Group only sourced origins; catalog indexes preserve credits and cover placement. */
export function LibraryPage(props: {
  section: Section;
  compact: boolean;
  now: number;
  artistView: ArtistView;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  reverse: boolean;
  coverFlow?: boolean;
  coverSize?: number;
  coverPosition: CoverPosition;
}) {
  const library = useLibrary();
  const listening = createAlbumListening({
    enabled: () => !library.demo && albumListeningCatalog(props.section),
    session: (source) => (source === "local" ? library.localSession() : library.serverSession()),
    checkpoint: () => {
      const state = library.player.state();
      const catalog = (["local", "server"] as const)
        .map((source) => {
          const snapshot = library.publicSnapshot(source);
          return `${snapshot?.scannedAt ?? 0}:${snapshot?.cachedAt ?? ""}:${snapshot?.albums.length ?? 0}:${snapshot?.tracks?.length ?? 0}`;
        })
        .join("|");
      return `${catalog}:${state.queue_id}:${state.index}:${state.reference}:${state.history_confirmed}`;
    },
  });
  const unplayed = (album: Album) =>
    albumListeningCatalog(props.section) && listening.completed(album.reference) === false;
  const index = createMemo(() => catalogIndex(library.artists(), library.albums()));
  const principals = createMemo(() => browseArtists(library.artists(), library.albums()));
  const countries = () => props.filters.countries ?? [];
  const setCountry = (value: string | null | undefined, additive = false) =>
    props.setFilters({
      ...props.filters,
      countries: selectCountries(countries(), value, additive),
    });
  const genres = () => selectedGenres(props.filters);
  const setGenre = (genre: string | undefined) =>
    props.setFilters({
      ...props.filters,
      genre: undefined,
      genres:
        genre === undefined
          ? []
          : genres().includes(genre)
            ? genres().filter((value) => value !== genre)
            : [...genres(), genre],
    });
  const compare = (a: string, b: string) =>
    normalizeName(a).localeCompare(normalizeName(b), locale()) * (props.reverse ? -1 : 1);
  const artists = createMemo(() => {
    const matched = filterArtists(principals(), library.albums(), props.filters);
    return [...matched].sort((a, b) => compare(a.name, b.name));
  });
  const composerNames = createMemo(() =>
    props.section === "composers"
      ? composerAlbumNames(library.albums(), library.artists(), props.filters.composers)
      : undefined,
  );
  const albums = createMemo(() => {
    const matched = filterAlbums(library.albums(), library.artists(), props.filters, props.now)
      .filter((item) => props.section !== "compilations" || item.compilation)
      .filter((item) => props.section !== "composers" || !!item.composers?.length);
    return props.section === "composers"
      ? composerAlbumOrder(matched, library.artists(), props.filters.composers, props.reverse)
      : [...matched].sort((a, b) => compare(a.title, b.title));
  });
  const artistView = () => artistCatalog(props.section);
  return (
    <section
      class="page library-page"
      classList={{
        "country-library": props.section === "countries",
        "artist-featured-library":
          props.section === "artists" && props.artistView === "discography",
      }}
      aria-label={t("Catalogue")}
    >
      <div classList={{ "country-layout": props.section === "countries" }}>
        <Show when={props.section === "countries"}>
          <CountryExplorer artists={principals()} selected={countries()} onSelect={setCountry} />
        </Show>
        <div class="library-results">
          <Feedback error persistent message={listening.error()} />
          <Show when={props.section === "composers"}>
            <Show when={library.albums().some((album) => album.composers === undefined)}>
              <p class="notice">
                {t(
                  "Le moteur Aède utilisé ne fournit pas encore les compositeurs. Mettez-le à jour et redémarrez-le, puis synchronisez Phémios.",
                )}
              </p>
            </Show>
          </Show>
          <Show when={props.section === "genres"}>
            <ChoiceChips
              label={t("Genres")}
              selected={genres()}
              onSelect={(value) => setGenre(value ?? undefined)}
              choices={[...new Set(principals().flatMap((item) => item.genres ?? [item.genre]))]
                .filter(Boolean)
                .map((value) => ({ id: value, label: value }))}
            />
          </Show>
          <Show
            when={artistView()}
            fallback={
              <Show
                when={["albums", "composers"].includes(props.section) && props.coverFlow}
                fallback={
                  <AlbumGrid
                    albums={albums()}
                    compact={props.compact}
                    unplayed={unplayed}
                    coverSize={props.coverSize}
                    reverse={props.reverse}
                    emptyIcon={sectionIcon(props.section)}
                  />
                }
              >
                <CoverFlow
                  albums={albums()}
                  unplayed={unplayed}
                  position={props.coverPosition}
                  reverse={props.reverse}
                  alphabetTitle={
                    props.section === "composers"
                      ? (album) => composerNames()?.get(album.reference) ?? ""
                      : undefined
                  }
                  caption={
                    props.section === "composers"
                      ? (album) =>
                          t("Compositeur : {0}", composerNames()?.get(album.reference) ?? "")
                      : undefined
                  }
                />
              </Show>
            }
          >
            <Show
              when={props.section === "artists"}
              fallback={
                <ul class="artist-grid">
                  <For each={artists()}>
                    {(artist) => {
                      const releases = index().albumsByArtist.get(artist.reference) ?? [];
                      const selection = artistCardSelection(artist, releases),
                        cover = selection.cover;
                      return (
                        <li>
                          <div class="artist-card">
                            <div class="artist-cover">
                              <a
                                class="artist-cover-link"
                                href={`#/artist/${encodeURIComponent(artist.reference)}`}
                              >
                                <Show
                                  when={library.image(artist.reference, "portrait")}
                                  fallback={
                                    <Show
                                      when={cover}
                                      fallback={
                                        <div
                                          class="artwork missing-art"
                                          aria-label={t("Pas de pochette disponible")}
                                        >
                                          ♪
                                        </div>
                                      }
                                    >
                                      {(album) => <Artwork album={album()} />}
                                    </Show>
                                  }
                                >
                                  {(url) => (
                                    <div class="artwork real-art">
                                      <img src={url()} alt={t("Portrait de {0}", artist.name)} />
                                    </div>
                                  )}
                                </Show>
                              </a>
                              <CoverPlay reference={selection.reference} title={selection.title} />
                            </div>
                            <a
                              class="artist-card-link"
                              href={`#/artist/${encodeURIComponent(artist.reference)}`}
                            >
                              <div>
                                <h2>
                                  {artist.name} <SourceBadge reference={artist.reference} />
                                </h2>
                                <p>
                                  {artist.genre} · {countryName(artist.countryCode, artist.country)}
                                </p>
                                <small>
                                  <AlbumCount value={releases.length} />
                                </small>
                              </div>
                            </a>
                            <CoverPlay
                              class="artist-list-play"
                              append
                              reference={selection.reference}
                              title={selection.title}
                            />
                          </div>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              }
            >
              <ArtistGallery artists={artists()} view={props.artistView} />
            </Show>
            <Show when={!artists().length}>
              <EmptyState icon={sectionIcon(props.section)}>
                {t("Aucun artiste dans cette sélection.")}{" "}
              </EmptyState>
            </Show>
          </Show>
          <Show when={library.demo}>
            <p class="demo-note">
              {t(
                "Données et visuels fictifs. La recherche porte sur les champs de ce catalogue ; la recherche globale d’Aède reste à raccorder.",
              )}{" "}
            </p>
          </Show>
        </div>
      </div>
    </section>
  );
}
