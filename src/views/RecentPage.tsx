import { t } from "../i18n";
import { createMemo } from "solid-js";
import { useLibrary } from "../library/context";
import { recentAlbums } from "../library/recent-albums";
import { searchAlbum } from "../library/filtering";
import { AlbumGrid } from "../components/AlbumGrid";
/** Unknown legacy dates stay unknown until a genuinely new catalog addition is observed. */
export function RecentPage(props: { query: string; now: number }) {
  const library = useLibrary();
  const albums = createMemo(() =>
    recentAlbums(library.albums(), props.now).filter((a) =>
      searchAlbum(
        a,
        library.artists().find((artist) => artist.reference === a.artist),
        props.query,
      ),
    ),
  );
  return (
    <section class="page recent-page">
      <p class="muted">
        {t("30 derniers jours · date d’entrée dans le catalogue ·")} {albums().length} {t("album")}{" "}
        {albums().length > 1 ? "s" : ""}
      </p>
      <AlbumGrid albums={albums()} emptyIcon="sparkles" />
    </section>
  );
}
