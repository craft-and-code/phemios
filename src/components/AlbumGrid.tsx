import { EmptyState } from "./EmptyState";
import { MissingAlbumCard } from "./MissingAlbumCard";
import type { MissingAlbum } from "../library/missing";
import { albumEntries } from "../library/album-order";
import { t } from "../i18n";
import { SourceBadge } from "./SourceBadge";
import { For, Show } from "solid-js";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";

/** Each local edition keeps its own identity and cover when opening details. */
export function AlbumGrid(props: {
  albums: readonly Album[];
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
      <div class="album-grid">
        <For each={entries()}>
          {(entry) => {
            const album = entry.album;
            return (
              <Show
                when={entry.missing}
                fallback={
                  <a class="album-card" href={`#/album/${encodeURIComponent(album.reference)}`}>
                    <Artwork album={album} />
                    <strong>{album.title}</strong>
                    <Show when={props.rating}>
                      <small class="card-rating">
                        <Show when={props.ratingFromArtist?.(album)}>{t("Artiste")} · </Show>
                        {"★".repeat(props.rating?.(album) ?? 0)}
                      </small>
                    </Show>
                    <small>
                      {album.year ?? t("Année inconnue")}{" "}
                      <SourceBadge reference={album.reference} />
                    </small>
                  </a>
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
