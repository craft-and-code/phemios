import { LibraryPage, type LibraryPageProps } from "./LibraryPage";
import type { Album } from "../library/types";
import { t } from "../i18n";
export type AlbumCatalogControls = Omit<
  LibraryPageProps,
  "section" | "artistView" | "baseAlbums" | "label"
>;
/** Albums and saved collection menus share one controlled album catalog. */
export function AlbumCatalog(
  props: AlbumCatalogControls & {
    albums?: readonly Album[] | undefined;
    label?: string | undefined;
  },
) {
  return (
    <LibraryPage
      {...props}
      section="albums"
      artistView="discography"
      baseAlbums={props.albums}
      label={props.label ?? t("Catalogue d’albums")}
    />
  );
}
