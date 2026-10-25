import { Show } from "solid-js";
import { t } from "../i18n";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
import { SourceBadge } from "./SourceBadge";
import { CoverPlay } from "./CoverPlay";
import { AlbumCardView } from "./AlbumCardView";
/** Separate links and playback avoid nested interactive controls in grid and list layouts. */
export function AlbumCard(props: {
  album: Album;
  compact?: boolean | undefined;
  unplayed?: boolean | undefined;
  rating?: number | undefined;
  ratingFromArtist?: boolean | undefined;
}) {
  const href = () => `#/album/${encodeURIComponent(props.album.reference)}`;
  return (
    <AlbumCardView
      href={href()}
      title={props.album.title}
      year={props.album.year ?? t("Année inconnue")}
      artwork={<Artwork album={props.album} unplayed={props.unplayed} />}
      source={<SourceBadge reference={props.album.reference} />}
      rating={
        <Show when={props.rating !== undefined}>
          <small class="card-rating">
            <Show when={props.ratingFromArtist}>{t("Artiste")} · </Show>
            {"★".repeat(props.rating ?? 0)}
          </small>
        </Show>
      }
      actions={
        <CoverPlay
          reference={props.album.reference}
          title={props.album.title}
          append={props.compact}
        />
      }
    />
  );
}
