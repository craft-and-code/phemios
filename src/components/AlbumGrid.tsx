import { t } from "../i18n";
import { referenceSource, sourceLabel } from "../library/sources";
import { For, Show } from "solid-js";
import type { Album } from "../library/types";
import { Artwork } from "./Artwork";

/** Each local edition keeps its own identity and cover when opening details. */
export function AlbumGrid(props: { albums: readonly Album[] }) {
  return (
    <Show
      when={props.albums.length}
      fallback={
        <p class="empty">{t("Aucun album dans cette sélection. Élargissez vos filtres.")}</p>
      }
    >
      <div class="album-grid">
        <For each={props.albums}>
          {(album) => (
            <a class="album-card" href={`#/album/${encodeURIComponent(album.reference)}`}>
              <Artwork album={album} />
              <strong>{album.title}</strong>
              <small>
                {album.year ?? t("Année inconnue")}{" "}
                <span class="source-badge">{sourceLabel(referenceSource(album.reference))}</span>
              </small>
            </a>
          )}
        </For>
      </div>
    </Show>
  );
}
