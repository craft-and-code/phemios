import { ResultCount } from "./ResultCount";
import { PageLoader } from "./PageLoader";
import { EmptyState } from "./EmptyState";
import { Feedback } from "./Feedback";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { t } from "../i18n";
import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { AlbumGrid } from "./AlbumGrid";
/** Optional collection expansion owns its loader and rejects replaced account/source answers. */
export function CollectionAlbums(props: { name: string; compact: boolean }) {
  const library = useLibrary();
  const read = createDiagnosticRead(
    () => {
      const session = library.session();
      return session
        ? { name: props.name, session, source: library.source(), albums: library.albums() }
        : false;
    },
    async (key) => {
      const response = await requestAede<{ items: unknown }>(
        "/api/me/v1/collection/albums",
        { name: key.name },
        "GET",
        null,
        key.source,
        key.session,
      );
      if (!Array.isArray(response.items) || response.items.some((r) => typeof r !== "string"))
        throw new Error(t("Collection Aède invalide."));
      const refs = new Set(response.items),
        albums = key.albums.filter((a) => refs.has(a.reference));
      if (albums.length !== refs.size)
        throw new Error(t("La collection a changé : resynchronisez la bibliothèque."));
      return albums;
    },
  );
  return (
    <section class="collection-album-results">
      <Show when={read.current()}>{(albums) => <ResultCount value={albums().length} />}</Show>
      <div class="collection-album-content">
        <Show
          when={read.loading()}
          fallback={
            <>
              <Feedback error persistent message={read.error()} />
              <Show when={read.current()}>
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
