import { Show } from "solid-js";
import { t } from "../i18n";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";
import { SourceBadge } from "./SourceBadge";
import { CoverPlay } from "./CoverPlay";
/** Separate links and playback avoid nested interactive controls in grid and list layouts. */
export function AlbumCard(props: {
  album: Album;
  unplayed?: boolean | undefined;
  rating?: number | undefined;
  ratingFromArtist?: boolean | undefined;
}) {
  const href = () => `#/album/${encodeURIComponent(props.album.reference)}`;
  return (
    <article class="album-card">
      <a class="album-art-link" href={href()}>
        <Artwork album={props.album} unplayed={props.unplayed} />
      </a>
      <a class="album-title-link" href={href()}>
        <strong>{props.album.title}</strong>
        <Show when={props.rating !== undefined}>
          <small class="card-rating">
            <Show when={props.ratingFromArtist}>{t("Artiste")} · </Show>
            {"★".repeat(props.rating ?? 0)}
          </small>
        </Show>
      </a>
      <small class="album-year">
        {props.album.year ?? t("Année inconnue")} <SourceBadge reference={props.album.reference} />
      </small>
      <CoverPlay reference={props.album.reference} title={props.album.title} />
    </article>
  );
}
