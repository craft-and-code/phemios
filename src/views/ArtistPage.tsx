import { createAccountSavedArticles } from "../encyclopedia/account-saved";
import { articleRetained } from "../encyclopedia/saved";
import { BiographyMore } from "../components/BiographyMore";
import type { BiographyNavigation } from "../library/biography-navigation";
import { biographyLinker } from "../library/biography-links";
import { ArtistBiography } from "../components/ArtistBiography";
import { createBiographyReading } from "../library/biography-reading-state";
import {
  downloadEncyclopedia,
  readArticleState,
  updateArticleState,
  readEncyclopediaTitle,
  readCachedBiography,
  isNative,
} from "../platform/desktop";
import { Feedback } from "../components/Feedback";
import { AlbumCount } from "../components/AlbumCount";
import { artistCatalogue } from "../library/artist-catalogue";
import { createToolPreferences } from "../library/tool-preferences";
import { BiographyText } from "../components/BiographyText";
import { MissingAlbumsStatus } from "../components/MissingAlbumsStatus";
import { SourceBadge } from "../components/SourceBadge";
import { t, countryName } from "../i18n";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { createMemo, createEffect, on, onCleanup, For, Show } from "solid-js";
import { PlayingBars } from "../components/PlayingBars";
import { AlbumGrid } from "../components/AlbumGrid";
import { useLibrary } from "../library/context";
import { sourceLink } from "../library/server";
import type { Artist } from "../library/types";
/** Present local editions and contributions without inventing a principal credit. */
export function ArtistPage(props: {
  artist: Artist;
  compact: boolean;
  onBiographyNavigation: BiographyNavigation;
  onGenres: (genres: readonly string[]) => void;
  onCountry: (country: string) => void;
}) {
  const library = useLibrary();
  const biography = createBiographyReading(
    () => props.artist,
    readEncyclopediaTitle,
    readCachedBiography,
  );
  createEffect(() =>
    props.onBiographyNavigation(
      biography.reading() ? { label: props.artist.name, back: biography.back } : undefined,
    ),
  );
  createEffect(
    on(
      () => !!biography.reading(),
      (reading) => {
        if (reading) document.getElementById("content")?.scrollTo({ top: 0 });
      },
    ),
  );
  onCleanup(() => props.onBiographyNavigation(undefined));
  const photos = createMemo(() => [
    ...new Set(
      ["portrait", "background", "banner"]
        .map((kind) =>
          library.image(props.artist.reference, kind as "portrait" | "background" | "banner"),
        )
        .filter((url): url is string => !!url),
    ),
  ]);
  const linker = createMemo(() => biographyLinker(library.artists(), props.artist.reference));
  const preferences = createToolPreferences();
  const catalogue = createMemo(() => artistCatalogue(props.artist, library.albums()));
  const albums = () => catalogue().featured;
  const appearances = () => (catalogue().credited ? [] : catalogue().appearances);
  const banner = () =>
    library.demo && props.artist.artwork
      ? "/demo/landscape.svg"
      : library.image(props.artist.reference, "banner");
  const background = () =>
    library.demo && props.artist.artwork
      ? "/demo/landscape.svg"
      : library.image(props.artist.reference, "background");
  return (
    <Show
      when={biography.reading()}
      fallback={
        <article class="artist-page">
          <header
            class="artist-hero"
            classList={{ "has-banner": !!banner() }}
            style={
              banner()
                ? {
                    "--artist-banner": `linear-gradient(90deg,#101917aa,#11191735),url("${banner()}")`,
                  }
                : {}
            }
          >
            <div>
              <p class="eyebrow">{t("ARTISTE")}</p>
              <div class="detail-title">
                <h1>{props.artist.name}</h1>
                <SourceBadge reference={props.artist.reference} />
              </div>
              <p>
                <For each={props.artist.genres ?? (props.artist.genre ? [props.artist.genre] : [])}>
                  {(genre, index) => (
                    <>
                      <Show when={index()}> · </Show>
                      <button
                        class="metadata-link"
                        onClick={() => props.onGenres(props.artist.genres ?? [props.artist.genre])}
                      >
                        {genre}
                      </button>
                    </>
                  )}
                </For>
                {props.artist.genre ? " · " : ""}
                <Show when={props.artist.country} fallback={t("Origine inconnue")}>
                  {(country) => (
                    <button class="metadata-link" onClick={() => props.onCountry(country())}>
                      {countryName(props.artist.countryCode, country())}
                    </button>
                  )}
                </Show>
              </p>
            </div>
          </header>
          <div class="artist-body">
            <Show when={background()}>
              {(url) => (
                <div
                  class="artist-backdrop"
                  aria-hidden="true"
                  style={{
                    "background-image": `linear-gradient(#11121383,#111213bf),url("${url()}")`,
                  }}
                />
              )}
            </Show>
            <div class="page artist-content">
              <section class="biography">
                <h2>{t("Biographie")}</h2>
                <p>
                  <BiographyText
                    reference={props.artist.reference}
                    text={
                      props.artist.biography || t("Aucune biographie récupérée pour cet artiste.")
                    }
                  />
                  <Show when={biography.target()}>
                    <BiographyMore
                      busy={biography.busy()}
                      disabled={!isNative()}
                      onOpen={() => {
                        if (isNative()) void biography.open();
                      }}
                    />
                  </Show>
                </p>
                <Show when={props.artist.biographyCredit}>
                  {(credit) => (
                    <small>
                      <Show when={sourceLink(credit().url)} fallback={credit().url}>
                        {(url) => (
                          <a href={url()} target="_blank" rel="noreferrer">
                            {t("Source de la biographie")}{" "}
                          </a>
                        )}
                      </Show>{" "}
                      · {credit().lang} · {credit().licence}
                    </small>
                  )}
                </Show>

                <Feedback error message={biography.error()} onClose={biography.clearError} />
                <Show when={library.demo}>
                  <small>{t("Texte fictif pour l’aperçu.")}</small>
                </Show>
              </section>
              <Show
                when={
                  library.player.current()?.album?.artist === props.artist.reference &&
                  ["playing", "paused"].includes(library.player.state().status)
                }
              >
                <div class="artist-playing track-heading">
                  <span class="track-number">{library.player.current()?.number}.</span>
                  <PlayingBars reference={library.player.current()?.reference ?? ""} />
                  <a
                    class="track-title"
                    href={`#/track/${encodeURIComponent(library.player.current()?.reference ?? "")}`}
                  >
                    {library.player.current()?.title}
                  </a>
                  <small>
                    {t("En")} {library.player.state().status === "paused" ? "pause" : "lecture"} ·{" "}
                    {library.player.current()?.album?.title}
                  </small>
                </div>
              </Show>
              <div class="section-heading">
                <h2>{catalogue().credited ? t("Albums crédités") : t("Discographie")}</h2>
                <span role="status">
                  <AlbumCount value={albums().length} /> {t("dans la sélection")}
                </span>
              </div>
              <AlbumGrid
                compact={props.compact}
                albums={albums()}
                missing={
                  preferences.value().showMissingAlbums && !catalogue().credited
                    ? library.missing
                        .rows()
                        .filter((row) => !row.set_aside && row.artist === props.artist.reference)
                    : []
                }
                chronological
              />
              <Show when={preferences.value().showMissingAlbums && !catalogue().credited}>
                <MissingAlbumsStatus artist={props.artist.reference} />
              </Show>
              <Show when={appearances().length}>
                <h2>{t("Participations")}</h2>
                <AlbumGrid compact={props.compact} albums={appearances()} chronological />
              </Show>
              <Show when={props.artist.relations?.length}>
                <section class="artist-collaborations">
                  <h2>{t("Collaborations")}</h2>
                  <For each={props.artist.relations}>
                    {(relation) => (
                      <a
                        class="collaboration-link"
                        href={`#/artist/${encodeURIComponent(relation.reference)}`}
                      >
                        {relation.name}
                      </a>
                    )}
                  </For>
                </section>
              </Show>
              <AnnotationPanel reference={props.artist.reference} kind="artist" />
            </div>
          </div>
        </article>
      }
    >
      {(article) => {
        const saved = createAccountSavedArticles(
          () => (isNative() ? library.session() : undefined),
          library.source,
          {
            read: readArticleState,
            update: updateArticleState,
          },
        );
        return (
          <ArtistBiography
            article={article()}
            onSave={(row) => {
              void saved.save(row);
            }}
            saved={articleRetained(article(), saved.rows())}
            saving={saved.pending()}
            saveDisabled={!isNative() || !saved.writable()}
            saveUnavailable={
              !library.session()
                ? t("Connectez-vous pour accéder aux données de votre compte.")
                : undefined
            }
            saveError={saved.error()}
            onDownload={isNative() ? downloadEncyclopedia : undefined}
            renderText={(text) => (
              <BiographyText reference={props.artist.reference} text={text} linker={linker()} />
            )}
            artist={props.artist.name}
            photos={photos()}
            error={biography.error()}
            onDismissError={biography.clearError}
          />
        );
      }}
    </Show>
  );
}
