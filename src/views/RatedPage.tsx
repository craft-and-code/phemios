import { createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { ratedAlbums, albumRating } from "../library/rated";
import { referenceSource } from "../library/sources";
import { searchAlbum, normalizeName } from "../library/filtering";
import { AlbumGrid } from "../components/AlbumGrid";
/** Ratings remain distinct from favourites, scoped to the selected authenticated owner. */
export function RatedPage(props: { query: string }) {
  const library = useLibrary(),
    [minimum, setMinimum] = createSignal(1);
  const albums = () =>
    ratedAlbums(
      library.albums().filter((row) => referenceSource(row.reference) === library.source()),
      library.annotations,
      minimum(),
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
      <label class="rating-filter">
        {t("Note minimale")}{" "}
        <select value={minimum()} onChange={(e) => setMinimum(Number(e.currentTarget.value))}>
          <For each={[1, 2, 3, 4, 5]}>
            {(rating) => <option value={rating}>{"★".repeat(rating)}</option>}
          </For>
        </select>
      </label>
      <Show
        when={library.session()}
        fallback={
          <p class="notice">{t("Connectez-vous pour accéder aux données de votre compte.")}</p>
        }
      >
        <Show
          when={albums().length}
          fallback={<p class="empty">{t("Aucun album noté dans cette sélection.")}</p>}
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
