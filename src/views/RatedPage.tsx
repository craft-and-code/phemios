import { EmptyState } from "../components/EmptyState";
import { StarRating } from "../components/StarRating";
import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { ratedAlbums, albumRating } from "../library/rated";
import { referenceSource } from "../library/sources";
import { searchAlbum, normalizeName } from "../library/filtering";
import { AlbumGrid } from "../components/AlbumGrid";
/** Ratings remain distinct from favourites, scoped to the selected authenticated owner. */
export function RatedPage(props: { query: string }) {
  const library = useLibrary(),
    [minimum, setMinimum] = createSignal(1),
    [maximum, setMaximum] = createSignal(5);
  const albums = () =>
    ratedAlbums(
      library.albums().filter((row) => referenceSource(row.reference) === library.source()),
      library.annotations,
      minimum(),
      maximum(),
    )
      .filter((album) =>
        searchAlbum(
          album,
          library.artists().find((artist) => artist.reference === album.artist),
          props.query,
        ),
      )
      .sort(
        (a, b) =>
          albumRating(b, library.annotations) - albumRating(a, library.annotations) ||
          normalizeName(a.title).localeCompare(normalizeName(b.title)),
      );
  return (
    <section class="page rated-page">
      <p class="muted">{t("Albums notés et discographies des artistes notés.")}</p>
      <div class="rating-filter">
        <span>{t("Note minimale")}</span>
        <StarRating
          value={minimum()}
          floor={1}
          label={t("Note minimale")}
          onChange={(value) => {
            const next = value ?? 1;
            setMinimum(next);
            if (next > maximum()) setMaximum(next);
          }}
        />
        <span>{t("Note maximale")}</span>
        <StarRating
          value={maximum()}
          floor={5}
          label={t("Note maximale")}
          onChange={(value) => {
            const next = value ?? 5;
            setMaximum(next);
            if (next < minimum()) setMinimum(next);
          }}
        />
      </div>
      <Show
        when={library.session()}
        fallback={
          <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
        }
      >
        <Show
          when={albums().length}
          fallback={
            <EmptyState icon="star">{t("Aucun album noté dans cette sélection.")}</EmptyState>
          }
        >
          <AlbumGrid
            albums={albums()}
            rating={(album) => albumRating(album, library.annotations)}
            ratingFromArtist={(album) =>
              !!album.artist &&
              (library.annotations[album.artist]?.rating ?? 0) >
                (library.annotations[album.reference]?.rating ?? 0)
            }
          />
        </Show>
      </Show>
    </section>
  );
}
