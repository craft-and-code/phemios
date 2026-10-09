import { EmptyState } from "../components/EmptyState";
import { locale } from "../i18n";
import { t, countryName } from "../i18n";
import { SourceBadge } from "../components/SourceBadge";
import { createMemo, For, Show } from "solid-js";
import { CountryGlobe } from "../components/CountryGlobe";
import { AlbumGrid } from "../components/AlbumGrid";
import { CoverPlay } from "../components/CoverPlay";
import { Artwork } from "../components/Artwork";
import { useLibrary } from "../library/context";
import {
  browseArtists,
  selectCountries,
  additiveCountrySelection,
  isMac,
} from "../library/selection";
import { catalogIndex } from "../library/index";
import { filterAlbums, filterArtists, normalizeName, selectedGenres } from "../library/filtering";
import type { Filters } from "../library/types";
import { sectionIcon, type Section } from "../navigation/routes";

/** Group only sourced origins; catalog indexes preserve credits and cover placement. */
export function LibraryPage(props: {
  section: Section;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  reverse: boolean;
}) {
  const library = useLibrary();
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
  const albums = createMemo(() =>
    [...filterAlbums(library.albums(), library.artists(), props.filters)]
      .filter((item) => props.section !== "compilations" || item.compilation)
      .sort((a, b) => compare(a.title, b.title)),
  );
  const artistView = () => ["artists", "countries", "genres"].includes(props.section);
  return (
    <section
      class="page library-page"
      classList={{ "country-library": props.section === "countries" }}
      aria-label={t("Catalogue")}
    >
      <div class="page-heading">
        <span role="status">
          {artistView() ? artists().length : albums().length} {t("résultat(s)")}
        </span>
      </div>
      <Show when={props.section === "countries"}>
        <CountryGlobe artists={principals()} selected={countries()} onSelect={setCountry} />
        <div class="choices" aria-label={t("Pays d’origine")}>
          <button aria-pressed={countries().length === 0} onClick={() => setCountry(undefined)}>
            {t("Tous")}{" "}
          </button>
          <For each={[...new Set(principals().map((item) => item.country))]}>
            {(value) => (
              <button
                aria-pressed={countries().includes(value)}
                onClick={(event) => setCountry(value, additiveCountrySelection(event, isMac()))}
              >
                {countryName(principals().find((a) => a.country === value)?.countryCode, value)}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.section === "genres"}>
        <div class="choices" aria-label={t("Genres")}>
          <button aria-pressed={!genres().length} onClick={() => setGenre(undefined)}>
            {t("Tous")}{" "}
          </button>
          <For
            each={[...new Set(principals().flatMap((item) => item.genres ?? [item.genre]))].filter(
              Boolean,
            )}
          >
            {(value) => (
              <button aria-pressed={genres().includes(value)} onClick={() => setGenre(value)}>
                {value}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show
        when={artistView()}
        fallback={
          <AlbumGrid
            albums={albums()}
            reverse={props.reverse}
            emptyIcon={sectionIcon(props.section)}
          />
        }
      >
        <ul class="artist-grid">
          <For each={artists()}>
            {(artist) => {
              const releases = index().albumsByArtist.get(artist.reference) ?? [];
              const cover = releases.find((item) => item.cover) ?? releases[0];
              return (
                <li>
                  <div class="artist-card">
                    <a
                      class="artist-card-link"
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
                      <div>
                        <h2>
                          {artist.name} <SourceBadge reference={artist.reference} />
                        </h2>
                        <p>
                          {artist.genre} · {countryName(artist.countryCode, artist.country)}
                        </p>
                        <small>
                          {releases.length} {t("albums · ouvrir la page")}
                        </small>
                      </div>
                    </a>
                    <CoverPlay
                      reference={cover?.reference ?? artist.reference}
                      title={cover?.title ?? artist.name}
                    />
                  </div>
                </li>
              );
            }}
          </For>
        </ul>
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
    </section>
  );
}
