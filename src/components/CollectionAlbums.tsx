import { StickyHeader } from "./StickyHeader";
import { ResultCount } from "./ResultCount";
import { t } from "../i18n";
import { createResource, Show } from "solid-js";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { AlbumGrid } from "./AlbumGrid";
/** Evaluate saved rules on Aède; never silently discard editions absent from a stale cache. */
export function CollectionAlbums(props: { name: string; compact: boolean }) {
  const library = useLibrary();
  const [result] = createResource(
    () => {
      const session = library.session();
      return session ? { name: props.name, session } : false;
    },
    async ({ name }) => {
      try {
        const response = await requestAede<{ items: unknown }>("/api/me/v1/collection/albums", {
          name,
        });
        if (!Array.isArray(response.items) || response.items.some((r) => typeof r !== "string"))
          throw new Error(t("Collection Aède invalide."));
        const refs = new Set(response.items),
          albums = library.albums().filter((a) => refs.has(a.reference));
        if (albums.length !== refs.size)
          throw new Error(t("La collection a changé : resynchronisez la bibliothèque."));
        return { albums };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  );
  return (
    <section>
      <StickyHeader>
        <div class="section-heading">
          <h2>{props.name}</h2>
          <Show when={result()?.albums}>{(albums) => <ResultCount value={albums().length} />}</Show>
        </div>
      </StickyHeader>
      <Show when={result.loading}>
        <p role="status">{t("Évaluation…")}</p>
      </Show>
      <Show when={result()?.error}>
        <p role="alert">{result()?.error}</p>
      </Show>
      <Show when={result()?.albums}>
        {(albums) => <AlbumGrid albums={albums()} compact={props.compact} />}
      </Show>
    </section>
  );
}
