import { createMemo } from "solid-js";
import { filterAlbums } from "../library/filtering";
import { ResultCount } from "./ResultCount";
import { PageLoader } from "./PageLoader";
import { EmptyState } from "./EmptyState";
import { Feedback } from "./Feedback";
import { createCollectionAlbums } from "../library/collection-albums";
import { t } from "../i18n";
import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { AlbumGrid } from "./AlbumGrid";
/** Optional collection expansion owns its loader and rejects replaced account/source answers. */
export function CollectionAlbums(props: {
  name: string;
  id?: string | undefined;
  compact: boolean;
  query?: string | undefined;
}) {
  const library = useLibrary();
  const read = createCollectionAlbums(() => {
    const session = library.session();
    return session
      ? {
          name: props.name,
          id: props.id,
          session,
          source: library.source(),
          albums: library.albums(),
        }
      : false;
  });
  const filtered = createMemo(() => {
    const albums = read.current();
    return albums
      ? filterAlbums(albums, library.artists(), {
          mode: "none",
          years: [0, 9999],
          alphabet: [0, 26],
          includeUnknownYear: true,
          query: props.query ?? "",
        })
      : undefined;
  });
  return (
    <section class="collection-album-results">
      <Show when={filtered()}>{(albums) => <ResultCount value={albums().length} />}</Show>
      <div class="collection-album-content">
        <Show
          when={read.loading()}
          fallback={
            <>
              <Feedback error persistent message={read.error()} />
              <Show when={filtered()}>
                {(albums) => (
                  <Show
                    when={albums().length}
                    fallback={
                      <EmptyState icon="library">
                        {t("Aucun album dans cette sélection.")}
                      </EmptyState>
                    }
                  >
                    <AlbumGrid albums={albums()} compact={props.compact} />
                  </Show>
                )}
              </Show>
            </>
          }
        >
          <PageLoader inline />
        </Show>
      </div>
    </section>
  );
}
