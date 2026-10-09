import { MissingAlbumsStatus } from "../components/MissingAlbumsStatus";
import { SourceBadge } from "../components/SourceBadge";
import { locale } from "../i18n";
import { t, countryName } from "../i18n";
import { AnnotationPanel } from "../components/AnnotationPanel";
import { createMemo, For, Show } from "solid-js";
import { PlayingBars } from "../components/PlayingBars";
import { AlbumGrid } from "../components/AlbumGrid";
import { useLibrary } from "../library/context";
import { belongsToArtist } from "../library/filtering";
import { sourceLink } from "../library/server";
import type { Artist } from "../library/types";
/** Present local editions and contributions without inventing a principal credit. */
export function ArtistPage(props: {
  artist: Artist;
  reverse: boolean;
  onGenres: (genres: readonly string[]) => void;
  onCountry: (country: string) => void;
}) {
  const library = useLibrary();
  const sort = (items: readonly import("../library/types").Album[]) =>
    [...items].sort((a, b) => a.title.localeCompare(b.title, locale()) * (props.reverse ? -1 : 1));
  const albums = createMemo(() =>
    sort(library.albums().filter((album) => album.artist === props.artist.reference)),
  );
  const appearances = createMemo(() =>
    sort(
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
              style={{ "background-image": `linear-gradient(#11121383,#111213bf),url("${url()}")` }}
            />
          )}
        </Show>
        <div class="page artist-content">
          <section class="biography">
            <h2>{t("Biographie")}</h2>
            <p>{props.artist.biography || t("Aucune biographie récupérée pour cet artiste.")}</p>
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
            <h2>{t("Discographie")}</h2>
            <span role="status">
              {albums().length} {t("albums dans la sélection")}
            </span>
          </div>
          <AlbumGrid
            albums={albums()}
            missing={library.missing
              .rows()
              .filter((row) => !row.set_aside && row.artist === props.artist.reference)}
            reverse={props.reverse}
          />
          <MissingAlbumsStatus artist={props.artist.reference} />
          <Show when={appearances().length}>
            <h2>{t("Participations")}</h2>
            <AlbumGrid albums={appearances()} />
          </Show>
          <AnnotationPanel reference={props.artist.reference} kind="artist" />
        </div>
      </div>
    </article>
  );
}
