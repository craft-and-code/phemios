import { Feedback } from "../components/Feedback";
import { Show } from "solid-js";
import { useLibrary } from "../library/context";
import { PageLoader } from "../components/PageLoader";
import { AlbumCatalog, type AlbumCatalogControls } from "./AlbumCatalog";
import type { createCollectionAlbums } from "../library/collection-albums";
import { AccountNotice } from "../components/AccountNotice";
import { EmptyState } from "../components/EmptyState";
import { t } from "../i18n";
/** A removed/foreign shortcut is explicit and never rebound by collection name. */
export function CollectionMenuPage(props: {
  target: {
    error?: string | undefined;
    id?: string | undefined;
    name: string | undefined;
    label: string;
  };
  catalog: AlbumCatalogControls;
  read: ReturnType<typeof createCollectionAlbums>;
}) {
  const library = useLibrary();
  const name = () => (library.session() ? props.target.name : undefined);
  return (
    <>
      <Feedback error message={props.target.error ?? ""} />
      <AccountNotice connected={!!library.session()} />
      <Show
        when={name() && props.target.id && !props.target.error ? props.target.id : undefined}
        fallback={
          <section class="page album-catalog-state">
            <EmptyState icon="library">
              {t(
                "Ce raccourci n’est pas disponible dans le compte actif. Choisissez une collection dans Paramètres → Navigation.",
              )}
            </EmptyState>
            <a href="#/collections">{t("Gérer les collections")}</a>
          </section>
        }
      >
        <Show
          when={!props.read.loading()}
          fallback={
            <section class="page album-catalog-state">
              <PageLoader />
            </section>
          }
        >
          <Feedback error persistent message={props.read.error()} />
          <Show when={props.read.error()}>
            <button onClick={() => void props.read.refetch()}>{t("Réessayer")}</button>
          </Show>
          <Show when={props.read.current()}>
            {(albums) => (
              <AlbumCatalog
                {...props.catalog}
                albums={albums()}
                label={t("Catalogue d’albums · {0}", props.target.label)}
              />
            )}
          </Show>
        </Show>
      </Show>
    </>
  );
}
