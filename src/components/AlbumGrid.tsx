import { EmptyState } from "./EmptyState";
import { MissingAlbumCard } from "./MissingAlbumCard";
import type { MissingAlbum } from "../library/missing";
import { albumEntries } from "../library/album-order";
import { t } from "../i18n";
import { AlbumCard } from "./AlbumCard";
import { For, Show } from "solid-js";
import type { Album } from "../library/types";

/** Each local edition keeps its own identity and cover when opening details. */
export function AlbumGrid(props: {
  albums: readonly Album[];
  unplayed?: ((album: Album) => boolean) | undefined;
  coverSize?: number | undefined;
  missing?: readonly MissingAlbum[];
  reverse?: boolean;
  chronological?: boolean;
  emptyIcon?: string;
  rating?: (album: Album) => number;
  ratingFromArtist?: (album: Album) => boolean;
}) {
  const entries = () =>
    albumEntries(props.albums, props.missing, props.chronological, props.reverse);
  return (
    <Show
      when={props.albums.length || props.missing?.length}
      fallback={
        <EmptyState icon={props.emptyIcon ?? "disc"}>
          {t("Aucun album dans cette sélection.")}
        </EmptyState>
      }
    >
      <div
        class="album-grid"
        style={props.coverSize ? { "--album-cover-min": `${props.coverSize}px` } : undefined}
      >
        <For each={entries()}>
          {(entry) => {
            const album = entry.album;
            return (
              <Show
                when={entry.missing}
                fallback={
                  <AlbumCard
                    album={album}
                    unplayed={props.unplayed?.(album)}
                    rating={props.rating?.(album)}
                    ratingFromArtist={props.ratingFromArtist?.(album)}
                  />
                }
              >
                {(missing) => <MissingAlbumCard album={missing()} />}
              </Show>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
